let pollInterval;
let currentBuzzerPlayerId = null;
let lastAnswerId = null; // Track last answer to show popup only once

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    startPolling();
});

function setupEventListeners() {
    // Question card clicks - answered questions should not be clickable
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
    
    // Answers are now auto-checked when players submit - no manual buttons needed
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

// Answers are now auto-checked when players submit - no manual submission needed
// The result will be shown automatically via polling updates

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
    // Update question cards based on answered status
    // First, get all questions with their answered status
    if (state.questions) {
        state.questions.forEach(q => {
            const card = document.querySelector(`[data-question-id="${q.id}"]`);
            if (card) {
                if (q.is_answered) {
                    card.dataset.answered = 'true';
                    // Add answered indicator if not present
                    if (!card.querySelector('.question-status.answered')) {
                        const statusDiv = document.createElement('div');
                        statusDiv.className = 'question-status answered';
                        statusDiv.textContent = 'Answered';
                        if (q.answered_by_name) {
                            const byDiv = document.createElement('div');
                            byDiv.className = 'answered-by';
                            byDiv.textContent = `By: ${q.answered_by_name}`;
                            card.appendChild(byDiv);
                        }
                        card.appendChild(statusDiv);
                    }
                } else {
                    card.dataset.answered = 'false';
                    // Remove answered indicators
                    const statusDiv = card.querySelector('.question-status.answered');
                    if (statusDiv) statusDiv.remove();
                    const byDiv = card.querySelector('.answered-by');
                    if (byDiv) byDiv.remove();
                }
            }
        });
    }
    
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
    
    // Update players list - show all players with their answer status, hide if game is ended
    const playersList = document.getElementById('playersList');
    const playersSection = document.querySelector('.players-section');
    if (state.game && state.game.is_ended) {
        if (playersSection) playersSection.style.display = 'none';
        playersList.innerHTML = '';
    } else {
        if (playersSection) {
            if (state.players && state.players.length > 0) {
                playersSection.style.display = 'block';
                // Update header to indicate answer status
                const playersHeader = playersSection.querySelector('h2');
                if (playersHeader && state.current_question) {
                    playersHeader.textContent = 'Players (Answered)';
                } else if (playersHeader) {
                    playersHeader.textContent = 'Players';
                }
            } else {
                playersSection.style.display = 'none';
            }
        }
        playersList.innerHTML = '';
        if (state.players) {
            state.players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                playerItem.dataset.playerId = player.id;
                if (state.buzzer_player && state.buzzer_player.id === player.id) {
                    playerItem.classList.add('active');
                }
                
                // Show answer status if available
                let answerStatusHtml = '';
                if (player.is_correct_answer !== null && player.is_correct_answer !== undefined) {
                    const statusClass = player.is_correct_answer ? 'correct' : 'incorrect';
                    const statusText = player.is_correct_answer ? '✓ Correct' : '✗ Incorrect';
                    answerStatusHtml = `<span class="answer-status ${statusClass}">${statusText}</span>`;
                }
                
                playerItem.innerHTML = `
                    <span class="player-name">${player.name}</span>
                    <span class="player-score">Score: $${player.score}</span>
                    ${answerStatusHtml}
                `;
                playersList.appendChild(playerItem);
            });
        }
    }
    
            // Update buzzer status
            const buzzerStatus = document.getElementById('buzzerStatus');
            const answerSection = document.getElementById('answerSection');
            const submittedAnswerDiv = document.getElementById('submittedAnswer');
            
            // Check for latest_answer popup first (before buzzer_player check) to handle incorrect answers immediately
            if (state.current_question && state.latest_answer && state.latest_answer.id && state.latest_answer.id !== lastAnswerId) {
                lastAnswerId = state.latest_answer.id;
                const isCorrect = state.latest_answer.is_correct;
                const playerName = state.latest_answer.player_name || (state.buzzer_player ? state.buzzer_player.name : 'Unknown');
                // Show popup immediately for both correct and incorrect answers
                showAnswerResultPopup({
                    is_correct: isCorrect,
                    player_name: playerName,
                    answer_text: state.latest_answer.answer_text,
                    question_value: isCorrect ? state.current_question.value : 0
                });
            }
            
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
                    // No current buzzer player - show latest answer if available (for incorrect answers that cleared buzzer)
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
                        submittedAnswerDiv.style.display = 'none';
                    }
                    
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
                // Check if we should show popup for a correct answer that just cleared the question
                if (state.recent_answer && state.recent_answer.id && state.recent_answer.id !== lastAnswerId) {
                    if (state.recent_answer.is_correct) {
                        lastAnswerId = state.recent_answer.id;
                        showAnswerResultPopup({
                            is_correct: true,
                            player_name: state.recent_answer.player_name,
                            answer_text: state.recent_answer.answer_text,
                            question_value: state.recent_answer.value
                        });
                    }
                }
                
                buzzerStatus.innerHTML = '<p>Waiting for question...</p>';
                buzzerStatus.className = 'buzzer-status';
                answerSection.style.display = 'none';
                currentBuzzerPlayerId = null;
            }
}

let popupAutoCloseTimer = null;

function showAnswerResultPopup(data) {
    const modal = document.getElementById('answerResultModal');
    const content = document.getElementById('answerResultContent');
    
    // Clear any existing auto-close timer
    if (popupAutoCloseTimer) {
        clearTimeout(popupAutoCloseTimer);
        popupAutoCloseTimer = null;
    }
    
    // Close modal if already open to prevent flashing
    if (modal.style.display === 'block') {
        modal.style.display = 'none';
    }
    
    const isCorrect = data.is_correct;
    const statusClass = isCorrect ? 'correct' : 'incorrect';
    const statusText = isCorrect ? '✓ CORRECT!' : '✗ INCORRECT';
    const message = isCorrect 
        ? `${data.player_name} answered correctly!<br>Answer: "${data.answer_text}"<br>Score: +$${data.question_value}`
        : `${data.player_name} answered incorrectly.<br>Answer: "${data.answer_text}"<br>Passing to next player...`;
    
    content.innerHTML = `
        <div class="answer-result-popup ${statusClass}">
            <h2>${statusText}</h2>
            <div class="answer-result-message">${message}</div>
            <button class="btn btn-primary" id="closePopupBtn">OK</button>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // Add close button handler
    document.getElementById('closePopupBtn').addEventListener('click', () => {
        modal.style.display = 'none';
        if (popupAutoCloseTimer) {
            clearTimeout(popupAutoCloseTimer);
            popupAutoCloseTimer = null;
        }
    });
    
    // Auto-close after 3 seconds
    popupAutoCloseTimer = setTimeout(() => {
        modal.style.display = 'none';
        popupAutoCloseTimer = null;
    }, 3000);
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (pollInterval) {
        clearInterval(pollInterval);
    }
});

