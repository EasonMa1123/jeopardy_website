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
    
    // Delete game buttons
    document.querySelectorAll('.delete-game-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const gameId = this.dataset.gameId;
            if (confirm('Are you sure you want to delete this game? This cannot be undone.')) {
                try {
                    const response = await fetch(`/host/delete_game/${gameId}`, {
                        method: 'POST'
                    });
                    const data = await response.json();
                    if (data.success) {
                        window.location.reload();
                    } else {
                        alert('Error deleting game: ' + (data.error || 'Unknown error'));
                    }
                } catch (error) {
                    console.error('Error:', error);
                    alert('Error deleting game');
                }
            }
        });
    });
});

