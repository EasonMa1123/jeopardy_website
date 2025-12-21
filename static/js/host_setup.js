document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    setupExportImport();
});

function setupExportImport() {
    const exportBtn = document.getElementById('exportQuestionsBtn');
    const importBtn = document.getElementById('importQuestionsBtn');
    const importFile = document.getElementById('importQuestionsFile');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', async function() {
            try {
                const response = await fetch(`/host/export_questions/${gameId}`);
                const data = await response.json();
                
                if (data.success) {
                    // Create and download JSON file
                    const jsonStr = JSON.stringify(data.questions, null, 2);
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `questions_${gameId}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    alert(`Exported ${data.questions.length} questions successfully!`);
                } else {
                    alert('Error exporting questions: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Export error:', error);
                alert('Error exporting questions: ' + error.message);
            }
        });
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', function() {
            importFile.click();
        });
    }
    
    if (importFile) {
        importFile.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const jsonData = JSON.parse(text);
                
                if (!Array.isArray(jsonData) && !Array.isArray(jsonData.questions)) {
                    alert('Invalid format: JSON must contain an array of questions or have a "questions" property');
                    return;
                }
                
                const questions = Array.isArray(jsonData) ? jsonData : jsonData.questions;
                
                if (!confirm(`Import ${questions.length} questions? This will add them to the existing questions.`)) {
                    return;
                }
                
                const response = await fetch(`/host/import_questions/${gameId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ questions: questions })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    alert(`Successfully imported ${data.imported_count} questions!`);
                    location.reload(); // Reload to show new questions
                } else {
                    alert('Error importing questions: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Import error:', error);
                alert('Error importing questions: ' + error.message);
            } finally {
                // Reset file input
                importFile.value = '';
            }
        });
    }
}

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
    const imageFileInput = document.getElementById('image_file');
    const audioFileInput = document.getElementById('audio_file');
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewImg = document.getElementById('imagePreviewImg');
    const audioPreview = document.getElementById('audioPreview');
    const audioPreviewPlayer = document.getElementById('audioPreviewPlayer');
    const removeImageBtn = document.getElementById('removeImageBtn');
    const removeAudioBtn = document.getElementById('removeAudioBtn');
    let isEditMode = false;
    let currentImagePath = null;
    let currentAudioPath = null;
    
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
        // Reset file previews
        imagePreview.style.display = 'none';
        audioPreview.style.display = 'none';
        removeImageBtn.style.display = 'none';
        removeAudioBtn.style.display = 'none';
        currentImagePath = null;
        currentAudioPath = null;
    }
    
    // Image file preview
    imageFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imagePreviewImg.src = e.target.result;
                imagePreview.style.display = 'block';
                removeImageBtn.style.display = 'inline-block';
            };
            reader.readAsDataURL(file);
        }
    });
    
    // Audio file preview
    audioFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            audioPreviewPlayer.src = url;
            audioPreview.style.display = 'block';
            removeAudioBtn.style.display = 'inline-block';
        }
    });
    
    // Remove image
    removeImageBtn.addEventListener('click', function() {
        imageFileInput.value = '';
        imagePreview.style.display = 'none';
        removeImageBtn.style.display = 'none';
        if (isEditMode && currentImagePath) {
            // Mark for removal on server
            currentImagePath = null;
        }
    });
    
    // Remove audio
    removeAudioBtn.addEventListener('click', function() {
        audioFileInput.value = '';
        audioPreview.style.display = 'none';
        removeAudioBtn.style.display = 'none';
        audioPreviewPlayer.src = '';
        if (isEditMode && currentAudioPath) {
            // Mark for removal on server
            currentAudioPath = null;
        }
    });
    
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
                
                // Handle image and audio
                currentImagePath = question.image_path || null;
                currentAudioPath = question.audio_path || null;
                
                if (currentImagePath) {
                    imagePreviewImg.src = `/uploads/${currentImagePath}`;
                    imagePreview.style.display = 'block';
                    removeImageBtn.style.display = 'inline-block';
                } else {
                    imagePreview.style.display = 'none';
                    removeImageBtn.style.display = 'none';
                }
                
                if (currentAudioPath) {
                    audioPreviewPlayer.src = `/uploads/${currentAudioPath}`;
                    audioPreview.style.display = 'block';
                    removeAudioBtn.style.display = 'inline-block';
                } else {
                    audioPreview.style.display = 'none';
                    removeAudioBtn.style.display = 'none';
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
        
        // Use FormData to support file uploads
        const formData = new FormData();
        formData.append('category', document.getElementById('category').value);
        formData.append('value', document.getElementById('value').value);
        formData.append('question_text', document.getElementById('question_text').value);
        formData.append('answer', answer);
        formData.append('question_type', questionType);
        formData.append('options', options);
        
        // Add files if selected
        if (imageFileInput.files[0]) {
            formData.append('image_file', imageFileInput.files[0]);
        }
        if (audioFileInput.files[0]) {
            formData.append('audio_file', audioFileInput.files[0]);
        }
        
        // For edit mode, handle file removal
        if (isEditMode) {
            if (!imageFileInput.files[0] && !currentImagePath && imagePreview.style.display === 'none') {
                // Image was removed
                formData.append('remove_image', 'true');
            }
            if (!audioFileInput.files[0] && !currentAudioPath && audioPreview.style.display === 'none') {
                // Audio was removed
                formData.append('remove_audio', 'true');
            }
        } else {
            formData.append('game_id', gameId);
        }
        
        try {
            let url;
            if (isEditMode) {
                url = `/host/update_question/${editQuestionIdInput.value}`;
            } else {
                url = '/host/add_question';
            }
            
            const response = await fetch(url, {
                method: 'POST',
                body: formData  // Don't set Content-Type header, browser will set it with boundary
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

