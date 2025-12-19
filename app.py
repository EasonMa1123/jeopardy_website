from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import pymysql
from datetime import datetime
import secrets
import json
from functools import wraps

app = Flask(__name__)
app.secret_key = secrets.token_hex(16)


timeout = 10
# Database configuration - will be updated with actual credentials
DB_CONFIG = {
    'charset': 'utf8mb4',
    'connect_timeout': timeout,
    'cursorclass': pymysql.cursors.DictCursor,
    'db': 'defaultdb',
    'host': 'mysql-2bd98258-d15-b95b.e.aivencloud.com',
    'password': 'AVNS_jY_AdoAn1a8svXP93g5',
    'read_timeout': timeout,
    'port': 22772,
    'user': 'avnadmin',
    'write_timeout': timeout
}



def get_db_connection():
    """Create and return a database connection"""
    return pymysql.connect(**DB_CONFIG)

def init_db():
    """Initialize database tables"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Users table (hosts)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Games table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    room_code VARCHAR(10) UNIQUE NOT NULL,
                    host_id INT NOT NULL,
                    status VARCHAR(20) DEFAULT 'waiting',
                    current_question_id INT,
                    question_start_time TIMESTAMP NULL,
                    buzzer_active BOOLEAN DEFAULT FALSE,
                    buzzer_timeout INT DEFAULT 3,
                    current_buzzer_player_id INT,
                    is_ended BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (host_id) REFERENCES users(id),
                    INDEX idx_room_code (room_code)
                )
            """)
            
            # Add is_ended column if it doesn't exist
            try:
                cursor.execute("ALTER TABLE games ADD COLUMN is_ended BOOLEAN DEFAULT FALSE")
            except:
                pass
            
            # Questions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS questions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    game_id INT NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    value INT NOT NULL,
                    question_text TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    question_type VARCHAR(20) DEFAULT 'type_answer',
                    options TEXT,
                    is_answered BOOLEAN DEFAULT FALSE,
                    answered_by_player_id INT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (game_id) REFERENCES games(id),
                    FOREIGN KEY (answered_by_player_id) REFERENCES players(id)
                )
            """)
            
            # Add new columns if they don't exist (for existing databases)
            try:
                cursor.execute("ALTER TABLE questions ADD COLUMN question_type VARCHAR(20) DEFAULT 'type_answer'")
            except:
                pass
            try:
                cursor.execute("ALTER TABLE questions ADD COLUMN options TEXT")
            except:
                pass
            try:
                cursor.execute("ALTER TABLE questions ADD COLUMN answered_by_player_id INT")
            except:
                pass
            
            # Players table (temporary players in game)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS players (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    game_id INT NOT NULL,
                    name VARCHAR(50) NOT NULL,
                    score INT DEFAULT 0,
                    buzzer_order INT DEFAULT 0,
                    can_buzz BOOLEAN DEFAULT TRUE,
                    FOREIGN KEY (game_id) REFERENCES games(id),
                    INDEX idx_game_id (game_id)
                )
            """)
            
            # Answers table (track answer attempts)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS answers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    question_id INT NOT NULL,
                    player_id INT NOT NULL,
                    answer_text TEXT NOT NULL,
                    is_correct BOOLEAN DEFAULT FALSE,
                    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (question_id) REFERENCES questions(id),
                    FOREIGN KEY (player_id) REFERENCES players(id)
                )
            """)
            
            conn.commit()
    finally:
        conn.close()

# Decorator to require host login
def host_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'host_id' not in session:
            return redirect(url_for('host_login'))
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/host/login', methods=['GET', 'POST'])
def host_login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", 
                             (username, password))
                user = cursor.fetchone()
                
                if user:
                    session['host_id'] = user['id']
                    session['username'] = user['username']
                    return redirect(url_for('host_dashboard'))
                else:
                    return render_template('host_login.html', error='Invalid credentials')
        finally:
            conn.close()
    
    return render_template('host_login.html')

@app.route('/host/register', methods=['GET', 'POST'])
def host_register():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # Check if username exists
                cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
                if cursor.fetchone():
                    return render_template('host_register.html', error='Username already exists')
                
                # Create new user
                cursor.execute("INSERT INTO users (username, password) VALUES (%s, %s)", 
                             (username, password))
                conn.commit()
                
                # Log in the new user
                cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
                user = cursor.fetchone()
                session['host_id'] = user['id']
                session['username'] = user['username']
                return redirect(url_for('host_dashboard'))
        except Exception as e:
            return render_template('host_register.html', error=str(e))
        finally:
            conn.close()
    
    return render_template('host_register.html')

@app.route('/host/logout')
def host_logout():
    session.clear()
    return redirect(url_for('host_login'))

@app.route('/host/dashboard')
@host_login_required
def host_dashboard():
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT g.*, 
                       (SELECT COUNT(*) FROM questions WHERE game_id = g.id) as question_count
                FROM games g WHERE g.host_id = %s ORDER BY created_at DESC
            """, (session['host_id'],))
            games = cursor.fetchall()
    finally:
        conn.close()
    
    return render_template('host_dashboard.html', games=games)

@app.route('/host/setup/<room_code>')
@host_login_required
def host_setup(room_code):
    """Page to set up questions before starting the game"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT * FROM games WHERE room_code = %s AND host_id = %s
            """, (room_code, session['host_id']))
            game = cursor.fetchone()
            
            if not game:
                return redirect(url_for('host_dashboard'))
            
            # Get questions
            cursor.execute("""
                SELECT * FROM questions WHERE game_id = %s ORDER BY category, value
            """, (game['id'],))
            questions = cursor.fetchall()
            
    finally:
        conn.close()
    
    return render_template('host_setup.html', game=game, questions=questions)

@app.route('/host/game/<room_code>')
@host_login_required
def host_game(room_code):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT g.*, 
                       (SELECT COUNT(*) FROM players WHERE game_id = g.id) as player_count
                FROM games g WHERE g.room_code = %s AND g.host_id = %s
            """, (room_code, session['host_id']))
            game = cursor.fetchone()
            
            if not game:
                return redirect(url_for('host_dashboard'))
            
            # Get questions with answered_by info
            cursor.execute("""
                SELECT q.*, p.name as answered_by_name
                FROM questions q
                LEFT JOIN players p ON q.answered_by_player_id = p.id
                WHERE q.game_id = %s ORDER BY q.category, q.value
            """, (game['id'],))
            questions = cursor.fetchall()
            
            # Group questions by category
            questions_by_category = {}
            for question in questions:
                category = question['category']
                if category not in questions_by_category:
                    questions_by_category[category] = []
                questions_by_category[category].append(question)
            
            # Get players
            cursor.execute("""
                SELECT * FROM players WHERE game_id = %s ORDER BY buzzer_order
            """, (game['id'],))
            players = cursor.fetchall()
            
            # Get current question if any
            current_question = None
            if game['current_question_id']:
                cursor.execute("SELECT * FROM questions WHERE id = %s", (game['current_question_id'],))
                current_question = cursor.fetchone()
                if current_question and current_question.get('options'):
                    import json
                    try:
                        current_question['options_list'] = json.loads(current_question['options'])
                    except:
                        current_question['options_list'] = []
            
    finally:
        conn.close()
    
    return render_template('host_game.html', game=game, questions=questions, 
                         questions_by_category=questions_by_category,
                         players=players, current_question=current_question)

@app.route('/host/create_game', methods=['POST'])
@host_login_required
def create_game():
    room_code = secrets.token_urlsafe(6).upper()[:6]
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO games (room_code, host_id) VALUES (%s, %s)
            """, (room_code, session['host_id']))
            conn.commit()
            game_id = cursor.lastrowid
    finally:
        conn.close()
    
    return jsonify({'success': True, 'room_code': room_code, 'game_id': game_id})

@app.route('/host/add_question', methods=['POST'])
@host_login_required
def add_question():
    data = request.json
    game_id = data.get('game_id')
    category = data.get('category')
    value = data.get('value')
    question_text = data.get('question_text')
    answer = data.get('answer')
    question_type = data.get('question_type', 'type_answer')
    options = data.get('options', '[]')
    
    import json
    # Validate options is valid JSON
    try:
        if question_type == 'multiple_choice':
            options_list = json.loads(options) if isinstance(options, str) else options
            if not isinstance(options_list, list) or len(options_list) < 2:
                return jsonify({'success': False, 'error': 'Multiple choice questions need at least 2 options'}), 400
            options = json.dumps(options_list)
        else:
            options = None
    except:
        return jsonify({'success': False, 'error': 'Invalid options format'}), 400
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Verify game belongs to host
            cursor.execute("SELECT id FROM games WHERE id = %s AND host_id = %s", 
                         (game_id, session['host_id']))
            if not cursor.fetchone():
                return jsonify({'success': False, 'error': 'Unauthorized'}), 403
            
            cursor.execute("""
                INSERT INTO questions (game_id, category, value, question_text, answer, question_type, options)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (game_id, category, value, question_text, answer, question_type, options))
            conn.commit()
            question_id = cursor.lastrowid
    finally:
        conn.close()
    
    return jsonify({'success': True, 'question_id': question_id})

@app.route('/host/delete_question/<int:question_id>', methods=['POST'])
@host_login_required
def delete_question(question_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Verify question belongs to host's game
            cursor.execute("""
                SELECT q.*, g.host_id 
                FROM questions q 
                JOIN games g ON q.game_id = g.id 
                WHERE q.id = %s
            """, (question_id,))
            question = cursor.fetchone()
            
            if not question or question['host_id'] != session['host_id']:
                return jsonify({'success': False, 'error': 'Unauthorized'}), 403
            
            cursor.execute("DELETE FROM questions WHERE id = %s", (question_id,))
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True})

@app.route('/host/delete_game/<int:game_id>', methods=['POST'])
@host_login_required
def delete_game(game_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Verify game belongs to host
            cursor.execute("SELECT id FROM games WHERE id = %s AND host_id = %s", 
                         (game_id, session['host_id']))
            if not cursor.fetchone():
                return jsonify({'success': False, 'error': 'Unauthorized'}), 403
            
            # Delete all related data
            cursor.execute("DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE game_id = %s)", (game_id,))
            cursor.execute("DELETE FROM questions WHERE game_id = %s", (game_id,))
            cursor.execute("DELETE FROM players WHERE game_id = %s", (game_id,))
            cursor.execute("DELETE FROM games WHERE id = %s", (game_id,))
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True})

@app.route('/host/end_game/<int:game_id>', methods=['POST'])
@host_login_required
def end_game(game_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Verify game belongs to host
            cursor.execute("SELECT id FROM games WHERE id = %s AND host_id = %s", 
                         (game_id, session['host_id']))
            if not cursor.fetchone():
                return jsonify({'success': False, 'error': 'Unauthorized'}), 403
            
            # Mark game as ended and clear current question
            cursor.execute("""
                UPDATE games 
                SET is_ended = TRUE, 
                    current_question_id = NULL,
                    buzzer_active = FALSE,
                    current_buzzer_player_id = NULL
                WHERE id = %s
            """, (game_id,))
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True})

@app.route('/host/restart_game/<int:game_id>', methods=['POST'])
@host_login_required
def restart_game(game_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Verify game belongs to host
            cursor.execute("SELECT id FROM games WHERE id = %s AND host_id = %s", 
                         (game_id, session['host_id']))
            if not cursor.fetchone():
                return jsonify({'success': False, 'error': 'Unauthorized'}), 403
            
            # Reset all player scores
            cursor.execute("""
                UPDATE players SET score = 0 WHERE game_id = %s
            """, (game_id,))
            
            # Reset all question answers
            cursor.execute("""
                UPDATE questions 
                SET is_answered = FALSE, answered_by_player_id = NULL 
                WHERE game_id = %s
            """, (game_id,))
            
            # Delete all answer records
            cursor.execute("""
                DELETE FROM answers 
                WHERE question_id IN (SELECT id FROM questions WHERE game_id = %s)
            """, (game_id,))
            
            # Reset game state
            cursor.execute("""
                UPDATE games 
                SET is_ended = FALSE,
                    current_question_id = NULL,
                    buzzer_active = FALSE,
                    current_buzzer_player_id = NULL,
                    question_start_time = NULL
                WHERE id = %s
            """, (game_id,))
            
            # Reset all players' buzzer status
            cursor.execute("""
                UPDATE players SET can_buzz = TRUE WHERE game_id = %s
            """, (game_id,))
            
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True})

@app.route('/host/get_question/<int:question_id>')
@host_login_required
def get_question(question_id):
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT q.*, g.host_id 
                FROM questions q 
                JOIN games g ON q.game_id = g.id 
                WHERE q.id = %s AND g.host_id = %s
            """, (question_id, session['host_id']))
            question = cursor.fetchone()
            
            if not question:
                return jsonify({'success': False, 'error': 'Question not found'}), 404
            
            if question.get('options'):
                import json
                try:
                    question['options_list'] = json.loads(question['options'])
                except:
                    question['options_list'] = []
    finally:
        conn.close()
    
    return jsonify({'success': True, 'question': question})

@app.route('/host/start_question', methods=['POST'])
@host_login_required
def start_question():
    data = request.json
    question_id = data.get('question_id')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Get question and verify ownership
            cursor.execute("""
                SELECT q.*, g.id as game_id, g.room_code 
                FROM questions q 
                JOIN games g ON q.game_id = g.id 
                WHERE q.id = %s AND g.host_id = %s
            """, (question_id, session['host_id']))
            question = cursor.fetchone()
            
            if not question:
                return jsonify({'success': False, 'error': 'Question not found'}), 404
            
            # Reset all players' buzzer status (they can all buzz after countdown)
            cursor.execute("""
                UPDATE players SET can_buzz = FALSE WHERE game_id = %s
            """, (question['game_id'],))
            
            # Update game state - start with buzzer inactive for countdown
            cursor.execute("""
                UPDATE games 
                SET current_question_id = %s, 
                    question_start_time = NOW(),
                    buzzer_active = FALSE,
                    current_buzzer_player_id = NULL
                WHERE id = %s
            """, (question_id, question['game_id']))
            
            # Enable buzzer after 3 seconds (handled by polling)
            
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True})

@app.route('/host/submit_answer', methods=['POST'])
@host_login_required
def submit_answer():
    data = request.json
    player_id = data.get('player_id')
    is_correct = data.get('is_correct', False)  # Host manually marks as correct/wrong
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Get player and current question
            cursor.execute("""
                SELECT p.*, g.current_question_id, g.id as game_id, g.host_id
                FROM players p
                JOIN games g ON p.game_id = g.id
                WHERE p.id = %s
            """, (player_id,))
            player = cursor.fetchone()
            
            if not player or player['host_id'] != session['host_id']:
                return jsonify({'success': False, 'error': 'Unauthorized'}), 403
            
            if not player['current_question_id']:
                return jsonify({'success': False, 'error': 'No active question'}), 400
            
            # Get question
            cursor.execute("SELECT * FROM questions WHERE id = %s", (player['current_question_id'],))
            question = cursor.fetchone()
            
            # Get the latest answer from this player for this question
            cursor.execute("""
                SELECT * FROM answers 
                WHERE question_id = %s AND player_id = %s 
                ORDER BY answered_at DESC LIMIT 1
            """, (question['id'], player_id))
            answer_record = cursor.fetchone()
            
            if not answer_record:
                return jsonify({'success': False, 'error': 'No answer found'}), 400
            
            # Update answer correctness
            cursor.execute("""
                UPDATE answers SET is_correct = %s WHERE id = %s
            """, (is_correct, answer_record['id']))
            
            if is_correct:
                # Update player score
                cursor.execute("""
                    UPDATE players SET score = score + %s WHERE id = %s
                """, (question['value'], player_id))
                
                # Mark question as answered and track who answered
                cursor.execute("""
                    UPDATE questions SET is_answered = TRUE, answered_by_player_id = %s WHERE id = %s
                """, (player_id, question['id'],))
                
                # Reset game state
                cursor.execute("""
                    UPDATE games 
                    SET current_question_id = NULL,
                        buzzer_active = FALSE,
                        current_buzzer_player_id = NULL
                    WHERE id = %s
                """, (player['game_id'],))
                
                # Reset all players' buzzer status
                cursor.execute("""
                    UPDATE players SET can_buzz = TRUE WHERE game_id = %s
                """, (player['game_id'],))
            else:
                # Find next player who has buzzed (can_buzz = FALSE) but hasn't answered yet
                # Get all players who buzzed, ordered by who buzzed first (we'll use buzzer_order as proxy)
                cursor.execute("""
                    SELECT id FROM players 
                    WHERE game_id = %s AND can_buzz = FALSE AND id != %s
                    ORDER BY buzzer_order
                """, (player['game_id'], player_id))
                buzzed_players = cursor.fetchall()
                
                next_player_id = None
                if buzzed_players:
                    # Get the first player who buzzed (after current player)
                    for buzzed_player in buzzed_players:
                        if buzzed_player['id'] != player_id:
                            next_player_id = buzzed_player['id']
                            break
                
                if next_player_id:
                    cursor.execute("""
                        UPDATE games SET current_buzzer_player_id = %s WHERE id = %s
                    """, (next_player_id, player['game_id']))
                else:
                    # No one else buzzed, re-enable buzzer for all players
                    cursor.execute("""
                        UPDATE players SET can_buzz = TRUE WHERE game_id = %s
                    """, (player['game_id'],))
                    cursor.execute("""
                        UPDATE games SET current_buzzer_player_id = NULL WHERE id = %s
                    """, (player['game_id'],))
            
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True, 'is_correct': is_correct})

@app.route('/host/game_state/<room_code>')
@host_login_required
def host_game_state(room_code):
    """Polling endpoint for host to get game state updates"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT g.* FROM games g 
                WHERE g.room_code = %s AND g.host_id = %s
            """, (room_code, session['host_id']))
            game = cursor.fetchone()
            
            if not game:
                return jsonify({'error': 'Game not found'}), 404
            
            # Get current question
            current_question = None
            if game['current_question_id']:
                cursor.execute("SELECT * FROM questions WHERE id = %s", (game['current_question_id'],))
                current_question = cursor.fetchone()
                if current_question and current_question.get('options'):
                    import json
                    try:
                        current_question['options_list'] = json.loads(current_question['options'])
                    except:
                        current_question['options_list'] = []
            
            # Get players
            cursor.execute("""
                SELECT * FROM players WHERE game_id = %s ORDER BY buzzer_order
            """, (game['id'],))
            players = cursor.fetchall()
            
            # Get current buzzer player
            buzzer_player = None
            if game['current_buzzer_player_id']:
                cursor.execute("SELECT * FROM players WHERE id = %s", (game['current_buzzer_player_id'],))
                buzzer_player = cursor.fetchone()
            
            # Get latest answer submission for current question
            latest_answer = None
            if game['current_question_id'] and game['current_buzzer_player_id']:
                cursor.execute("""
                    SELECT a.*, p.name as player_name 
                    FROM answers a
                    JOIN players p ON a.player_id = p.id
                    WHERE a.question_id = %s AND a.player_id = %s
                    ORDER BY a.answered_at DESC LIMIT 1
                """, (game['current_question_id'], game['current_buzzer_player_id']))
                latest_answer = cursor.fetchone()
            
            # Get all answer attempts for current question (to show history)
            answer_history = []
            if game['current_question_id']:
                cursor.execute("""
                    SELECT a.*, p.name as player_name 
                    FROM answers a
                    JOIN players p ON a.player_id = p.id
                    WHERE a.question_id = %s
                    ORDER BY a.answered_at DESC
                """, (game['current_question_id'],))
                answer_history = cursor.fetchall()
            
            # Check countdown and enable buzzer after 3 seconds
            countdown_remaining = 0
            if game['current_question_id'] and game['question_start_time']:
                cursor.execute("""
                    SELECT TIMESTAMPDIFF(SECOND, %s, NOW()) as elapsed
                """, (game['question_start_time'],))
                elapsed = cursor.fetchone()['elapsed']
                
                if elapsed < 3:
                    # Still in countdown
                    countdown_remaining = 3 - elapsed
                    if game['buzzer_active']:
                        cursor.execute("""
                            UPDATE games SET buzzer_active = FALSE WHERE id = %s
                        """, (game['id'],))
                        conn.commit()
                elif not game['buzzer_active'] and not game['current_buzzer_player_id']:
                    # Countdown finished, enable buzzer
                    cursor.execute("""
                        UPDATE games SET buzzer_active = TRUE WHERE id = %s
                    """, (game['id'],))
                    cursor.execute("""
                        UPDATE players SET can_buzz = TRUE WHERE game_id = %s
                    """, (game['id'],))
                    conn.commit()
                    game['buzzer_active'] = True
            
            # No timeout - buzzer stays active until someone answers correctly
            buzzer_expired = False
            
    finally:
        conn.close()
    
    return jsonify({
        'game': game,
        'current_question': current_question,
        'players': players,
        'buzzer_player': buzzer_player,
        'buzzer_expired': buzzer_expired,
        'latest_answer': latest_answer,
        'answer_history': answer_history,
        'countdown_remaining': countdown_remaining
    })

# Player routes
@app.route('/player/join', methods=['GET', 'POST'])
def player_join():
    if request.method == 'POST':
        room_code = request.form.get('room_code', '').upper().strip()
        player_name = request.form.get('player_name', '').strip()
        
        if not room_code or not player_name:
            return render_template('player_join.html', error='Room code and name are required')
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cursor:
                # Check if game exists
                cursor.execute("SELECT * FROM games WHERE room_code = %s", (room_code,))
                game = cursor.fetchone()
                
                if not game:
                    return render_template('player_join.html', error='Invalid room code')
                
                if game.get('is_ended'):
                    return render_template('player_join.html', error='This game has ended')
                
                # Check if player name already exists in this game
                cursor.execute("""
                    SELECT id FROM players WHERE game_id = %s AND name = %s
                """, (game['id'], player_name))
                existing = cursor.fetchone()
                
                if existing:
                    player_id = existing['id']
                else:
                    # Get next buzzer order
                    cursor.execute("""
                        SELECT COALESCE(MAX(buzzer_order), 0) + 1 as next_order 
                        FROM players WHERE game_id = %s
                    """, (game['id'],))
                    result = cursor.fetchone()
                    buzzer_order = result['next_order']
                    
                    # Create new player
                    cursor.execute("""
                        INSERT INTO players (game_id, name, buzzer_order)
                        VALUES (%s, %s, %s)
                    """, (game['id'], player_name, buzzer_order))
                    conn.commit()
                    player_id = cursor.lastrowid
                
                # Store in session
                session['player_id'] = player_id
                session['player_name'] = player_name
                session['room_code'] = room_code
                
                return redirect(url_for('player_game', room_code=room_code))
        finally:
            conn.close()
    
    return render_template('player_join.html')

@app.route('/player/game/<room_code>')
def player_game(room_code):
    if 'player_id' not in session or session.get('room_code') != room_code:
        return redirect(url_for('player_join'))
    
    return render_template('player_game.html', room_code=room_code, 
                         player_name=session.get('player_name'))

@app.route('/player/buzz', methods=['POST'])
def player_buzz():
    if 'player_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    
    player_id = session['player_id']
    room_code = session.get('room_code')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Get player and game
            cursor.execute("""
                SELECT p.*, g.id as game_id, g.buzzer_active, g.current_question_id,
                       g.question_start_time, g.buzzer_timeout, g.current_buzzer_player_id
                FROM players p
                JOIN games g ON p.game_id = g.id
                WHERE p.id = %s AND g.room_code = %s
            """, (player_id, room_code))
            player = cursor.fetchone()
            
            if not player:
                return jsonify({'success': False, 'error': 'Player not found'}), 404
            
            if not player['buzzer_active']:
                return jsonify({'success': False, 'error': 'Buzzer not active'}), 400
            
            if not player['can_buzz']:
                return jsonify({'success': False, 'error': 'You have already buzzed in'}), 400
            
            # Allow multiple players to buzz - set this player as current buzzer if no one is currently answering
            # If someone is already answering, they can still buzz (will be queued for next turn)
            if not player['current_buzzer_player_id']:
                # No one is currently answering, set this player as buzzer
                cursor.execute("""
                    UPDATE games SET current_buzzer_player_id = %s WHERE id = %s
                """, (player_id, player['game_id']))
            
            # Disable buzzer for this player (they can't buzz again)
            cursor.execute("""
                UPDATE players SET can_buzz = FALSE WHERE id = %s
            """, (player_id,))
            
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True})

@app.route('/player/submit_answer', methods=['POST'])
def player_submit_answer():
    if 'player_id' not in session:
        return jsonify({'success': False, 'error': 'Not logged in'}), 401
    
    data = request.json
    answer_text = data.get('answer_text', '').strip()
    player_id = session['player_id']
    room_code = session.get('room_code')
    
    if not answer_text:
        return jsonify({'success': False, 'error': 'Answer required'}), 400
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # Verify player is the current buzzer
            cursor.execute("""
                SELECT p.*, g.current_buzzer_player_id, g.current_question_id, g.id as game_id
                FROM players p
                JOIN games g ON p.game_id = g.id
                WHERE p.id = %s AND g.room_code = %s
            """, (player_id, room_code))
            player = cursor.fetchone()
            
            if not player:
                return jsonify({'success': False, 'error': 'Player not found'}), 404
            
            if player['current_buzzer_player_id'] != player_id:
                return jsonify({'success': False, 'error': 'Not your turn'}), 400
            
            if not player['current_question_id']:
                return jsonify({'success': False, 'error': 'No active question'}), 400
            
            # Get question
            cursor.execute("SELECT * FROM questions WHERE id = %s", (player['current_question_id'],))
            question = cursor.fetchone()
            
            # Auto-check answer (for convenience, but host can override)
            is_correct_auto = answer_text.lower().strip() == question['answer'].lower().strip()
            
            # Record answer (initially marked as not correct, host will judge)
            cursor.execute("""
                INSERT INTO answers (question_id, player_id, answer_text, is_correct)
                VALUES (%s, %s, %s, %s)
            """, (question['id'], player_id, answer_text, is_correct_auto))
            
            # If auto-check says correct, apply it immediately
            # Otherwise, wait for host to judge
            if is_correct_auto:
                # Update player score
                cursor.execute("""
                    UPDATE players SET score = score + %s WHERE id = %s
                """, (question['value'], player_id))
                
                # Mark question as answered
                cursor.execute("""
                    UPDATE questions SET is_answered = TRUE WHERE id = %s
                """, (question['id'],))
                
                # Reset game state
                cursor.execute("""
                    UPDATE games 
                    SET current_question_id = NULL,
                        buzzer_active = FALSE,
                        current_buzzer_player_id = NULL
                    WHERE id = %s
                """, (player['game_id'],))
                
                # Reset all players' buzzer status
                cursor.execute("""
                    UPDATE players SET can_buzz = TRUE WHERE game_id = %s
                """, (player['game_id'],))
            
            conn.commit()
    finally:
        conn.close()
    
    return jsonify({'success': True, 'is_correct': is_correct_auto})

@app.route('/player/game_state/<room_code>')
def player_game_state(room_code):
    """Polling endpoint for player to get game state updates"""
    if 'player_id' not in session or session.get('room_code') != room_code:
        return jsonify({'error': 'Unauthorized'}), 401
    
    player_id = session['player_id']
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT g.* FROM games g WHERE g.room_code = %s
            """, (room_code,))
            game = cursor.fetchone()
            
            if not game:
                return jsonify({'error': 'Game not found'}), 404
            
            if game.get('is_ended'):
                return jsonify({'error': 'Game ended', 'game_ended': True}), 200
            
            # Get current player
            cursor.execute("SELECT * FROM players WHERE id = %s", (player_id,))
            player = cursor.fetchone()
            
            # Get current question
            current_question = None
            if game['current_question_id']:
                cursor.execute("SELECT * FROM questions WHERE id = %s", (game['current_question_id'],))
                current_question = cursor.fetchone()
                # Don't send answer to player
                if current_question:
                    current_question.pop('answer', None)
                    # Parse options if MC question
                    if current_question.get('options'):
                        import json
                        try:
                            current_question['options_list'] = json.loads(current_question['options'])
                        except:
                            current_question['options_list'] = []
            
            # Get all players (for leaderboard)
            cursor.execute("""
                SELECT id, name, score, buzzer_order FROM players 
                WHERE game_id = %s ORDER BY score DESC, buzzer_order
            """, (game['id'],))
            players = cursor.fetchall()
            
            # Check countdown and enable buzzer after 3 seconds
            countdown_remaining = 0
            if game['current_question_id'] and game['question_start_time']:
                cursor.execute("""
                    SELECT TIMESTAMPDIFF(SECOND, %s, NOW()) as elapsed
                """, (game['question_start_time'],))
                elapsed = cursor.fetchone()['elapsed']
                
                if elapsed < 3:
                    # Still in countdown
                    countdown_remaining = 3 - elapsed
                    if game['buzzer_active']:
                        cursor.execute("""
                            UPDATE games SET buzzer_active = FALSE WHERE id = %s
                        """, (game['id'],))
                        conn.commit()
                elif not game['buzzer_active'] and not game['current_buzzer_player_id']:
                    # Countdown finished, enable buzzer
                    cursor.execute("""
                        UPDATE games SET buzzer_active = TRUE WHERE id = %s
                    """, (game['id'],))
                    cursor.execute("""
                        UPDATE players SET can_buzz = TRUE WHERE game_id = %s
                    """, (game['id'],))
                    conn.commit()
                    game['buzzer_active'] = True
                    player['can_buzz'] = True
            
            # No timeout - buzzer stays active until someone answers correctly
            buzzer_expired = False
            can_buzz = player['can_buzz'] and game['buzzer_active']
            
            is_current_buzzer = game['current_buzzer_player_id'] == player_id
            
    finally:
        conn.close()
    
    return jsonify({
        'game': game,
        'current_question': current_question,
        'player': player,
        'players': players,
        'can_buzz': can_buzz,
        'buzzer_expired': buzzer_expired,
        'is_current_buzzer': is_current_buzzer,
        'countdown_remaining': countdown_remaining
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)

