let pollInterval;
let currentBuzzerPlayerId = null;

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    startPolling();
});

function setupEventListeners() {
    // Question card clicks
    document.querySelectorAll('.question-card').forEach(card => {
        card.addEventListener('click', function() {
            if (this.dataset.answered === 'true') return;
            
            const questionId = this.dataset.questionId;
            showQuestionPopup(questionId);
        });
    });
    
    // Restart game button
    document.getElementById('restartGameBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to restart this game? All scores and question answers will be reset.')) {
            try {
                const response = await fetch(`/host/restart_game/${gameId}`, {
                    method: 'POST'
                });
                const data = await response.json();
                if (data.success) {
                    alert('Game restarted. All scores and answers have been reset.');
                    window.location.reload();
                } else {
                    alert('Error restarting game: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error restarting game');
            }
        }
    });
    
    // End game button
    document.getElementById('endGameBtn').addEventListener('click', async () => {
        if (confirm('Are you sure you want to end this game? All players will be kicked out.')) {
            try {
                const response = await fetch(`/host/end_game/${gameId}`, {
                    method: 'POST'
                });
                const data = await response.json();
                if (data.success) {
                    alert('Game ended. All players have been kicked out.');
                    window.location.reload();
                } else {
                    alert('Error ending game: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error ending game');
            }
        }
    });
    
    // Question modal close
    const questionModal = document.getElementById('questionModal');
    const questionModalClose = questionModal.querySelector('.close');
    questionModalClose.addEventListener('click', () => {
        questionModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === questionModal) {
            questionModal.style.display = 'none';
        }
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

async function showQuestionPopup(questionId) {
    // Get question details from the card
    const card = document.querySelector(`[data-question-id="${questionId}"]`);
    const category = card.dataset.category;
    const value = card.dataset.value;
    
    // Show popup with question (without answer)
    const modal = document.getElementById('questionModal');
    const modalContent = document.getElementById('questionModalContent');
    
    // Fetch full question details
    try {
        const response = await fetch(`/host/get_question/${questionId}`);
        const data = await response.json();
        
        if (data.success) {
            const question = data.question;
            let optionsHtml = '';
            
            if (question.question_type === 'multiple_choice' && question.options_list) {
                const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
                optionsHtml = '<div class="mc-options-display"><p><strong>Options:</strong></p>';
                question.options_list.forEach((option, index) => {
                    optionsHtml += `<div class="mc-option-display">${labels[index]}. ${option}</div>`;
                });
                optionsHtml += '</div>';
            }
            
            modalContent.innerHTML = `
                <h2>${category} - $${value}</h2>
                <div class="question-text-large">${question.question_text}</div>
                ${optionsHtml}
                <div id="answerDisplay" style="display: none;">
                    <div class="answer-text-large"><strong>Answer:</strong> ${question.answer}</div>
                </div>
                <div class="question-popup-actions">
                    <button id="startQuestionBtn" class="btn btn-primary">Start Question</button>
                    <button id="showAnswerBtn" class="btn btn-secondary">Show Answer</button>
                </div>
            `;
            
            modal.style.display = 'block';
            
            // Start question button
            document.getElementById('startQuestionBtn').addEventListener('click', async () => {
                await startQuestion(questionId);
                modal.style.display = 'none';
            });
            
            // Show answer button
            document.getElementById('showAnswerBtn').addEventListener('click', () => {
                document.getElementById('answerDisplay').style.display = 'block';
            });
        } else {
            alert('Error loading question: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error loading question');
    }
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
    // Update current question display (don't show answer until correct)
    const currentQuestionDisplay = document.getElementById('currentQuestionDisplay');
    if (state.current_question) {
        const question = state.current_question;
        // Only show answer if question is answered
        let answerHtml = '';
        if (question.is_answered && question.answer) {
            answerHtml = `<div class="answer-text">Answer: ${question.answer}</div>`;
        }
        
        currentQuestionDisplay.innerHTML = `
            <div class="current-question">
                <div class="question-header">
                    <span class="category">${question.category}</span>
                    <span class="value">$${question.value}</span>
                </div>
                <div class="question-text">${question.question_text}</div>
                ${answerHtml}
            </div>
        `;
        
        // Mark question as active in grid
        document.querySelectorAll('.question-card').forEach(card => {
            if (card.dataset.questionId == question.id) {
                card.style.border = '3px solid #ffc107';
                card.style.boxShadow = '0 0 10px rgba(255, 193, 7, 0.5)';
            } else {
                card.style.border = '';
                card.style.boxShadow = '';
            }
        });
    } else {
        currentQuestionDisplay.innerHTML = '<p>No question active. Click a question card to start.</p>';
        // Remove active border from all cards
        document.querySelectorAll('.question-card').forEach(card => {
            card.style.border = '';
            card.style.boxShadow = '';
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
                        const isCorrect = state.latest_answer.is_correct;
                        const statusClass = isCorrect ? 'correct' : 'incorrect';
                        const statusText = isCorrect ? '✓ Correct' : '✗ Incorrect';
                        submittedAnswerDiv.innerHTML = `
                            <div class="answer-status ${statusClass}">${statusText}</div>
                            <div><strong>Answer:</strong> ${state.latest_answer.answer_text}</div>
                        `;
                        submittedAnswerDiv.style.display = 'block';
                    } else {
                        submittedAnswerDiv.innerHTML = '<em>Waiting for answer...</em>';
                        submittedAnswerDiv.style.display = 'block';
                    }
                    
                    // Show answer history
                    const answerHistory = document.getElementById('answerHistory');
                    const answerHistoryList = document.getElementById('answerHistoryList');
                    if (state.answer_history && state.answer_history.length > 0) {
                        answerHistory.style.display = 'block';
                        answerHistoryList.innerHTML = '';
                        state.answer_history.forEach(answer => {
                            const isCorrect = answer.is_correct;
                            const statusClass = isCorrect ? 'correct' : 'incorrect';
                            const statusText = isCorrect ? '✓ Correct' : '✗ Incorrect';
                            const item = document.createElement('div');
                            item.className = `answer-history-item ${statusClass}`;
                            item.innerHTML = `
                                <div class="answer-history-player">${answer.player_name}</div>
                                <div class="answer-history-answer">${answer.answer_text}</div>
                                <div class="answer-history-status ${statusClass}">${statusText}</div>
                            `;
                            answerHistoryList.appendChild(item);
                        });
                    } else {
                        answerHistory.style.display = 'none';
                    }
                } else {
                    if (state.countdown_remaining && state.countdown_remaining > 0) {
                        buzzerStatus.innerHTML = `<p>Countdown: ${Math.ceil(state.countdown_remaining)}s</p>`;
                        buzzerStatus.className = 'buzzer-status';
                        answerSection.style.display = 'none';
                        currentBuzzerPlayerId = null;
                    } else {
                        const elapsed = Math.max(0, state.game.buzzer_timeout - Math.floor((new Date() - new Date(state.game.question_start_time)) / 1000) + 3);
                        buzzerStatus.innerHTML = `<p>Buzzer active! Time remaining: ${elapsed}s</p>`;
                        buzzerStatus.className = 'buzzer-status active';
                        answerSection.style.display = 'none';
                        currentBuzzerPlayerId = null;
                    }
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

