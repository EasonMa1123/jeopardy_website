let pollInterval;
let canBuzz = false;
let isCurrentBuzzer = false;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    startPolling();
});

function setupEventListeners() {
    const buzzerBtn = document.getElementById('buzzerBtn');
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');
    const answerInput = document.getElementById('answerInput');
    
    buzzerBtn.addEventListener('click', async () => {
        if (!canBuzz) return;
        
        try {
            const response = await fetch('/player/buzz', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                buzzerBtn.disabled = true;
                buzzerBtn.textContent = 'BUZZED IN!';
                buzzerBtn.classList.add('active');
            } else {
                alert('Error: ' + (data.error || 'Could not buzz in'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error buzzing in');
        }
    });
    
    submitAnswerBtn.addEventListener('click', async () => {
        const answer = answerInput.value.trim();
        if (!answer) {
            alert('Please enter an answer');
            return;
        }
        
        try {
            const response = await fetch('/player/submit_answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ answer_text: answer })
            });
            
            const data = await response.json();
            
            if (data.success) {
                if (data.is_correct) {
                    alert('Correct! +$' + (data.value || ''));
                } else {
                    alert('Incorrect. Passing to next player...');
                }
                answerInput.value = '';
                // State will update via polling
            } else {
                alert('Error: ' + (data.error || 'Could not submit answer'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error submitting answer');
        }
    });
    
    // Allow Enter key to submit answer
    answerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitAnswerBtn.click();
        }
    });
}

function startPolling() {
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/player/game_state/${roomCode}`);
            const data = await response.json();
            
            if (data.error) {
                console.error('Polling error:', data.error);
                return;
            }
            
            updateGameState(data);
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 500); // Poll every 500ms for near real-time updates
}

function updateGameState(state) {
    // Update current question display
    const currentQuestionDisplay = document.getElementById('currentQuestionDisplay');
    const buzzerSection = document.getElementById('buzzerSection');
    const answerSection = document.getElementById('answerSection');
    const buzzerBtn = document.getElementById('buzzerBtn');
    const buzzerStatus = document.getElementById('buzzerStatus');
    
    if (state.current_question) {
        const question = state.current_question;
        currentQuestionDisplay.innerHTML = `
            <div class="current-question">
                <div class="question-header">
                    <span class="category">${question.category}</span>
                    <span class="value">$${question.value}</span>
                </div>
                <div class="question-text">${question.question_text}</div>
            </div>
        `;
        
        // Show buzzer if active and player can buzz
        if (state.game.buzzer_active && !state.buzzer_expired) {
            if (state.is_current_buzzer) {
                // This player buzzed in - show answer input
                buzzerSection.style.display = 'none';
                answerSection.style.display = 'block';
                isCurrentBuzzer = true;
            } else if (state.can_buzz && !state.buzzer_player) {
                // Buzzer is active and no one has buzzed yet
                buzzerSection.style.display = 'block';
                answerSection.style.display = 'none';
                buzzerBtn.disabled = false;
                buzzerBtn.textContent = 'BUZZ IN';
                buzzerBtn.classList.remove('active');
                
                // Show countdown
                if (state.game.question_start_time) {
                    const elapsed = Math.max(0, state.game.buzzer_timeout - Math.floor((new Date() - new Date(state.game.question_start_time)) / 1000));
                    buzzerStatus.textContent = `Time remaining: ${elapsed}s`;
                }
                canBuzz = true;
            } else {
                // Someone else buzzed or buzzer expired
                buzzerSection.style.display = 'block';
                answerSection.style.display = 'none';
                buzzerBtn.disabled = true;
                if (state.buzzer_player) {
                    buzzerStatus.textContent = `${state.buzzer_player.name} buzzed in!`;
                } else {
                    buzzerStatus.textContent = 'Buzzer time expired!';
                }
                canBuzz = false;
            }
        } else {
            // Buzzer not active or expired
            buzzerSection.style.display = 'none';
            answerSection.style.display = 'none';
            canBuzz = false;
        }
    } else {
        currentQuestionDisplay.innerHTML = '<p>Waiting for host to start a question...</p>';
        buzzerSection.style.display = 'none';
        answerSection.style.display = 'none';
        canBuzz = false;
        isCurrentBuzzer = false;
    }
    
    // Update player score
    if (state.player) {
        document.getElementById('playerScore').textContent = '$' + state.player.score;
    }
    
    // Update leaderboard
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';
    if (state.players && state.players.length > 0) {
        state.players.forEach(player => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            if (player.id === state.player.id) {
                item.classList.add('current-player');
            }
            item.innerHTML = `
                <span>${player.name}</span>
                <span>$${player.score}</span>
            `;
            leaderboardList.appendChild(item);
        });
    }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});

