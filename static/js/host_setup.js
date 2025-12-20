document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
});

function setupEventListeners() {
    // Add Question Modal
    const addQuestionBtn = document.getElementById('addQuestionBtn');
    const modal = document.getElementById('addQuestionModal');
    const closeBtn = modal.querySelector('.close');
    const addQuestionForm = document.getElementById('addQuestionForm');
    const questionTypeSelect = document.getElementById('question_type');
    const mcOptionsSection = document.getElementById('mcOptionsSection');
    const typeAnswerSection = document.getElementById('typeAnswerSection');
    const answerInput = document.getElementById('answer');
    const mcOptionsInput = document.getElementById('mcOptions');
    const editQuestionIdInput = document.getElementById('editQuestionId');
    const modalTitle = document.getElementById('modalTitle');
    const submitBtn = document.getElementById('submitBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    let isEditMode = false;
    
    // Toggle between MC and type answer
    questionTypeSelect.addEventListener('change', function() {
        if (this.value === 'multiple_choice') {
            mcOptionsSection.style.display = 'block';
            typeAnswerSection.style.display = 'none';
            answerInput.removeAttribute('required');
            mcOptionsInput.setAttribute('required', 'required');
        } else {
            mcOptionsSection.style.display = 'none';
            typeAnswerSection.style.display = 'block';
            mcOptionsInput.removeAttribute('required');
            answerInput.setAttribute('required', 'required');
        }
    });
    
    // Reset form to add mode
    function resetToAddMode() {
        isEditMode = false;
        editQuestionIdInput.value = '';
        modalTitle.textContent = 'Add Question';
        submitBtn.textContent = 'Add Question';
        cancelEditBtn.style.display = 'none';
        addQuestionForm.reset();
        questionTypeSelect.dispatchEvent(new Event('change'));
    }
    
    addQuestionBtn.addEventListener('click', () => {
        resetToAddMode();
        modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        resetToAddMode();
    });
    
    cancelEditBtn.addEventListener('click', () => {
        resetToAddMode();
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            resetToAddMode();
        }
    });
    
    // Question card click handlers for editing
    document.querySelectorAll('.question-card').forEach(card => {
        card.addEventListener('click', async function(e) {
            // Don't trigger if clicking the delete button
            if (e.target.classList.contains('delete-question-btn')) {
                return;
            }
            
            const questionId = this.dataset.questionId;
            await loadQuestionForEdit(questionId);
        });
    });
    
    async function loadQuestionForEdit(questionId) {
        try {
            const response = await fetch(`/host/get_question/${questionId}`);
            const data = await response.json();
            
            if (data.success) {
                const question = data.question;
                isEditMode = true;
                editQuestionIdInput.value = questionId;
                modalTitle.textContent = 'Edit Question';
                submitBtn.textContent = 'Update Question';
                cancelEditBtn.style.display = 'inline-block';
                
                // Fill form fields
                document.getElementById('category').value = question.category;
                document.getElementById('value').value = question.value;
                document.getElementById('question_text').value = question.question_text;
                document.getElementById('question_type').value = question.question_type;
                
                // Set question type and update form
                questionTypeSelect.dispatchEvent(new Event('change'));
                
                if (question.question_type === 'multiple_choice' && question.options_list) {
                    // For MC, we need to unshuffle to show the correct answer first
                    // The stored options are shuffled, but we need to find which is correct
                    const correctAnswer = question.answer;
                    const optionsList = question.options_list;
                    // Put correct answer first
                    const unshuffled = [correctAnswer];
                    optionsList.forEach(opt => {
                        if (opt !== correctAnswer) {
                            unshuffled.push(opt);
                        }
                    });
                    mcOptionsInput.value = unshuffled.join('\n');
                } else {
                    answerInput.value = question.answer;
                }
                
                modal.style.display = 'block';
            } else {
                alert('Error loading question: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error loading question');
        }
    }
    
    addQuestionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const questionType = questionTypeSelect.value;
        let answer = '';
        let options = '[]';
        
        if (questionType === 'multiple_choice') {
            const optionsText = mcOptionsInput.value.trim();
            const optionsList = optionsText.split('\n').filter(opt => opt.trim());
            if (optionsList.length < 2) {
                alert('Multiple choice questions need at least 2 options');
                return;
            }
            answer = optionsList[0].trim(); // First option is correct
            options = JSON.stringify(optionsList.map(opt => opt.trim()));
        } else {
            answer = answerInput.value.trim();
        }
        
        const formData = {
            category: document.getElementById('category').value,
            value: parseInt(document.getElementById('value').value),
            question_text: document.getElementById('question_text').value,
            answer: answer,
            question_type: questionType,
            options: options
        };
        
        try {
            let url, method;
            if (isEditMode) {
                url = `/host/update_question/${editQuestionIdInput.value}`;
                method = 'POST';
            } else {
                url = '/host/add_question';
                method = 'POST';
                formData.game_id = gameId;
            }
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                modal.style.display = 'none';
                resetToAddMode();
                // Reload to show updated question
                window.location.reload();
            } else {
                alert(`Error ${isEditMode ? 'updating' : 'adding'} question: ` + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`Error ${isEditMode ? 'updating' : 'adding'} question`);
        }
    });
    
    // Delete question buttons
    document.querySelectorAll('.delete-question-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const questionId = this.dataset.questionId;
            if (confirm('Are you sure you want to delete this question?')) {
                try {
                    const response = await fetch(`/host/delete_question/${questionId}`, {
                        method: 'POST'
                    });
                    const data = await response.json();
                    if (data.success) {
                        window.location.reload();
                    } else {
                        alert('Error deleting question: ' + (data.error || 'Unknown error'));
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Error deleting question');
                }
            }
        });
    });
}

