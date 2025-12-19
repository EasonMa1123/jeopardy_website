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
    
    addQuestionBtn.addEventListener('click', () => {
        modal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        addQuestionForm.reset();
        questionTypeSelect.dispatchEvent(new Event('change'));
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            addQuestionForm.reset();
            questionTypeSelect.dispatchEvent(new Event('change'));
        }
    });
    
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
            game_id: gameId,
            category: document.getElementById('category').value,
            value: parseInt(document.getElementById('value').value),
            question_text: document.getElementById('question_text').value,
            answer: answer,
            question_type: questionType,
            options: options
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
                questionTypeSelect.dispatchEvent(new Event('change'));
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

