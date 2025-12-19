let pollInterval;
let currentBuzzerPlayerId = null;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    startPolling();
});

function setupEventListeners() {
    // Add Question Modal
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const modal = document.getElementById('addQuestionModal');
    const closeBtn = modal.querySelector('.close');
    const addQuestionForm = document.getElementById('addQuestionForm');
    
    addQuestionBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            game_id: gameId,
            category: document.getElementById('category').value,
            value: parseInt(document.getElementById('value').value),
            question_text: document.getElementById('question_text').value,
            answer: document.getElementById('answer').value
        };
        
        try {
            const response = await fetch('/host/add_question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                modal.style.display = 'none';
                addQuestionForm.reset();
                // Reload to show new question
                window.location.reload();
            } else {
                alert('Error adding question: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error adding question');
        }
    });
    
    // Question card clicks
    document.querySelectorAll('.question-card').forEach(card => {
        card.addEventListener('click', function() {
            if (this.classList.contains('answered')) return;
            
            const questionId = this.dataset.questionId;
            startQuestion(questionId);
        });
    });
    
    // Answer buttons
    document.getElementById('correctBtn').addEventListener('click', () => {
        if (currentBuzzerPlayerId) {
            submitAnswer(currentBuzzerPlayerId, true);
        }
    });
    
    document.getElementById('wrongBtn').addEventListener('click', () => {
        if (currentBuzzerPlayerId) {
            submitAnswer(currentBuzzerPlayerId, false);
        }
    });
}

async function startQuestion(questionId) {
    try {
        const response = await fetch('/host/start_question', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question_id: questionId })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update will come from polling
        } else {
            alert('Error starting question: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error starting question');
    }
}

async function submitAnswer(playerId, isCorrect) {
    try {
        const response = await fetch('/host/submit_answer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                player_id: playerId,
                is_correct: isCorrect
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentBuzzerPlayerId = null;
            // Update will come from polling
        } else {
            alert('Error submitting answer: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error submitting answer');
    }
}

function startPolling() {
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/host/game_state/${roomCode}`);
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
    if (state.current_question) {
        const question = state.current_question;
        currentQuestionDisplay.innerHTML = `
            <div class="current-question">
                <div class="question-header">
                    <span class="category">${question.category}</span>
                    <span class="value">$${question.value}</span>
                </div>
                <div class="question-text">${question.question_text}</div>
                <div class="answer-text">Answer: ${question.answer}</div>
            </div>
        `;
        
        // Mark question as active in grid
        document.querySelectorAll('.question-card').forEach(card => {
            if (card.dataset.questionId == question.id) {
                card.style.border = '3px solid #ffc107';
            }
        });
    } else {
        currentQuestionDisplay.innerHTML = '<p>No question active. Click a question card to start.</p>';
        // Remove active border from all cards
        document.querySelectorAll('.question-card').forEach(card => {
            card.style.border = '';
        });
    }
    
    // Update players list
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    state.players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.dataset.playerId = player.id;
        if (state.buzzer_player && state.buzzer_player.id === player.id) {
            playerItem.classList.add('active');
        }
        playerItem.innerHTML = `
            <span class="player-name">${player.name}</span>
            <span class="player-score">Score: $${player.score}</span>
        `;
        playersList.appendChild(playerItem);
    });
    
            // Update buzzer status
            const buzzerStatus = document.getElementById('buzzerStatus');
            const answerSection = document.getElementById('answerSection');
            const submittedAnswerDiv = document.getElementById('submittedAnswer');
            
            if (state.game.buzzer_active && state.current_question) {
                if (state.buzzer_expired) {
                    buzzerStatus.innerHTML = '<p>Buzzer time expired!</p>';
                    buzzerStatus.className = 'buzzer-status';
                    answerSection.style.display = 'none';
                } else if (state.buzzer_player) {
                    buzzerStatus.innerHTML = `<p>${state.buzzer_player.name} buzzed in!</p>`;
                    buzzerStatus.className = 'buzzer-status active';
                    answerSection.style.display = 'block';
                    document.getElementById('currentAnswerer').textContent = state.buzzer_player.name;
                    currentBuzzerPlayerId = state.buzzer_player.id;
                    
                    // Show submitted answer if available
                    if (state.latest_answer) {
                        submittedAnswerDiv.innerHTML = `<strong>Answer:</strong> ${state.latest_answer.answer_text}`;
                        submittedAnswerDiv.style.display = 'block';
                    } else {
                        submittedAnswerDiv.innerHTML = '<em>Waiting for answer...</em>';
                        submittedAnswerDiv.style.display = 'block';
                    }
                } else {
                    const elapsed = Math.max(0, state.game.buzzer_timeout - Math.floor((new Date() - new Date(state.game.question_start_time)) / 1000));
                    buzzerStatus.innerHTML = `<p>Buzzer active! Time remaining: ${elapsed}s</p>`;
                    buzzerStatus.className = 'buzzer-status active';
                    answerSection.style.display = 'none';
                    currentBuzzerPlayerId = null;
                }
            } else {
                buzzerStatus.innerHTML = '<p>Waiting for question...</p>';
                buzzerStatus.className = 'buzzer-status';
                answerSection.style.display = 'none';
                currentBuzzerPlayerId = null;
            }
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});

