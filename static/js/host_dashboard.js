document.addEventListener('DOMContentLoaded', function() {
    const createGameBtn = document.getElementById('createGameBtn');
    const gamesList = document.getElementById('gamesList');
    
    createGameBtn.addEventListener('click', async function() {
        try {
            const response = await fetch('/host/create_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Reload page to show new game
                window.location.reload();
            } else {
                alert('Error creating game: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error creating game');
        }
    });
});

