# Jeopardy Game Website

A web-based Jeopardy game built with Python Flask backend, featuring real-time gameplay without WebSockets (using polling for Google Cloud compatibility).

## Features

- **Host System**: Login/registration for game hosts
- **Question Management**: Create and manage Jeopardy-style questions
- **Player System**: Join games with room code and player name (no login required)
- **Real-time Gameplay**: 
  - 3-second buzzer window for players
  - Answer submission and scoring
  - Leaderboard updates
- **Google Cloud Compatible**: Uses polling instead of WebSockets for real-time updates

## Setup

### Prerequisites

- Python 3.7+
- MySQL database
- pip

### Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure database connection in `app.py`:
```python
DB_CONFIG = {
    'host': 'your_host',
    'user': 'your_username',
    'password': 'your_password',
    'database': 'jeopardy_db',
    'charset': 'utf8mb4',
    'cursorclass': pymysql.cursors.DictCursor
}
```

3. Run the application:
```bash
python app.py
```

The database tables will be automatically created on first run.

4. Access the application:
- Home: http://localhost:5000
- Host Login: http://localhost:5000/host/login
- Player Join: http://localhost:5000/player/join

## Usage

### For Hosts

1. Register/Login as a host
2. Create a new game (generates a room code)
3. Add questions with categories, values, questions, and answers
4. Click on a question card to start it
5. Players have 3 seconds to buzz in
6. Mark answers as correct or wrong
7. Game continues until question is answered correctly

### For Players

1. Enter room code and your name
2. Wait for host to start a question
3. When question appears, you have 3 seconds to press "BUZZ IN"
4. First player to buzz gets to answer
5. Submit your answer
6. If wrong, next player gets a chance (cycles through all players)

## Database Schema

The application creates the following tables:
- `users`: Host accounts
- `games`: Game rooms
- `questions`: Jeopardy questions
- `players`: Players in each game
- `answers`: Answer attempts

## Deployment to Google Cloud

This application is designed to work on Google Cloud Platform without WebSockets. The polling mechanism (500ms intervals) provides near real-time updates.

1. Set up a Cloud SQL MySQL instance
2. Update `DB_CONFIG` with Cloud SQL connection details
3. Deploy using App Engine, Cloud Run, or Compute Engine
4. Ensure your database allows connections from your deployment

## Notes

- Passwords are stored in plain text (consider hashing for production)
- Room codes are 6 characters
- Buzzer timeout is 3 seconds (configurable in database)
- Questions can be marked as answered to prevent reuse

## Future Enhancements

- Password hashing
- Question import/export
- Game history
- Custom buzzer timeout per game
- Double Jeopardy support

