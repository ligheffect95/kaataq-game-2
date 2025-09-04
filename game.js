// Firebase-Enabled Kaataq Game Implementation
class KaataqGame {
    constructor() {
        // Local UI state (not synced)
        this.gameState = 'welcome';
        this.currentPlayerId = null;
        this.currentRoomId = null;
        this.timer = null;
        this.timeRemaining = 0;

        // Firebase database reference
        this.database = firebase.database();
        this.currentRoomRef = null;

        this.config = {
            minPlayers: 3,
            maxPlayers: 8,
            discussionTime: 45,
            votingTime: 30
        };

        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
        ];

        this.init();
    }

    init() {
        this.bindEvents();
        this.showScreen('welcome');
    }

    bindEvents() {
        // Welcome screen
        document.getElementById('info-btn').addEventListener('click', () => {
            this.toggleInfoPanel();
        });

        document.getElementById('create-btn').addEventListener('click', () => {
            this.createRoom();
        });

        document.getElementById('join-btn').addEventListener('click', () => {
            this.showScreen('join-screen');
        });

        // Join screen
        document.getElementById('join-game-btn').addEventListener('click', () => {
            this.joinRoom();
        });

        document.getElementById('back-btn').addEventListener('click', () => {
            this.showScreen('welcome');
        });

        // Lobby screen
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('leave-btn').addEventListener('click', () => {
            this.leaveRoom();
        });

        // Game controls
        document.querySelectorAll('.hand-btn[data-choice]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.makeStickChoice(e.target.closest('.hand-btn').dataset.choice);
            });
        });

        document.querySelectorAll('.hand-btn[data-vote]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.castVote(e.target.closest('.hand-btn').dataset.vote);
            });
        });

        document.getElementById('next-round-btn').addEventListener('click', () => {
            this.nextRound();
        });

        // End game
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.resetGame();
        });

        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.showScreen('welcome');
            this.resetGame();
        });
    }

    // Utility methods
    generateRoomCode() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9);
    }

    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById(screenId).classList.add('active');
        this.gameState = screenId;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    toggleInfoPanel() {
        const panel = document.getElementById('info-panel');
        panel.classList.toggle('hidden');
    }

    // Room management with Firebase
    createRoom() {
        const playerName = prompt('Enter your name:');
        if (!playerName || !playerName.trim()) return;

        this.currentRoomId = this.generateRoomCode();
        this.currentPlayerId = this.generatePlayerId();

        // Create room in Firebase
        const roomData = {
            roomCode: this.currentRoomId,
            host: this.currentPlayerId,
            gameStarted: false,
            currentRound: 1,
            currentHolderIndex: 0,
            roundPhase: 'waiting',
            stickChoice: null,
            players: {
                [this.currentPlayerId]: {
                    id: this.currentPlayerId,
                    name: playerName.trim(),
                    score: 0,
                    color: this.colors[0],
                    isHost: true
                }
            },
            votes: {},
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        this.currentRoomRef = this.database.ref('rooms/' + this.currentRoomId);
        this.currentRoomRef.set(roomData).then(() => {
            this.setupRoomListeners();
            this.showScreen('lobby');
            this.showToast('Room created! Share the code with others.', 'success');
        }).catch((error) => {
            console.error('Error creating room:', error);
            this.showToast('Error creating room: ' + error.message, 'error');
        });
    }

    joinRoom() {
        const roomCode = document.getElementById('room-code-input').value.trim();
        const playerName = document.getElementById('player-name-input').value.trim();

        if (!roomCode || !playerName) {
            this.showToast('Please enter room code and your name.', 'error');
            return;
        }

        this.currentRoomId = roomCode;
        this.currentPlayerId = this.generatePlayerId();
        this.currentRoomRef = this.database.ref('rooms/' + roomCode);

        // Check if room exists
        this.currentRoomRef.once('value').then((snapshot) => {
            if (!snapshot.exists()) {
                this.showToast('Room not found!', 'error');
                return;
            }

            const roomData = snapshot.val();
            if (roomData.gameStarted) {
                this.showToast('Game already in progress!', 'error');
                return;
            }

            const playerCount = roomData.players ? Object.keys(roomData.players).length : 0;
            if (playerCount >= this.config.maxPlayers) {
                this.showToast('Room is full!', 'error');
                return;
            }

            // Add player to room
            const playerRef = this.currentRoomRef.child('players/' + this.currentPlayerId);
            playerRef.set({
                id: this.currentPlayerId,
                name: playerName,
                score: 0,
                color: this.colors[playerCount % this.colors.length],
                isHost: false
            }).then(() => {
                this.setupRoomListeners();
                this.showScreen('lobby');
                this.showToast('Joined room successfully!', 'success');
            }).catch((error) => {
                console.error('Error joining room:', error);
                this.showToast('Error joining room: ' + error.message, 'error');
            });
        }).catch((error) => {
            console.error('Error checking room:', error);
            this.showToast('Error joining room: ' + error.message, 'error');
        });
    }

    setupRoomListeners() {
        if (!this.currentRoomRef) return;

        // Listen for room updates
        this.currentRoomRef.on('value', (snapshot) => {
            if (!snapshot.exists()) {
                this.showToast('Room no longer exists', 'error');
                this.showScreen('welcome');
                return;
            }

            const roomData = snapshot.val();
            this.handleRoomUpdate(roomData);
        });
    }

    handleRoomUpdate(roomData) {
        // Update lobby if in lobby screen
        if (this.gameState === 'lobby') {
            this.updateLobby(roomData);
        }

        // Update game screen if game is active
        if (roomData.gameStarted && this.gameState !== 'game-screen' && this.gameState !== 'end-screen') {
            this.showScreen('game-screen');
        }

        if (this.gameState === 'game-screen') {
            this.updateGameDisplay(roomData);
        }

        // Check for game end
        if (roomData.gameEnded) {
            this.showEndScreen(roomData);
        }
    }

    updateLobby(roomData) {
        document.getElementById('room-code-display').textContent = this.currentRoomId;

        const players = roomData.players || {};
        const playerCount = Object.keys(players).length;
        document.getElementById('player-count').textContent = playerCount;

        const playersList = document.getElementById('players-list');
        playersList.innerHTML = '';

        Object.values(players).forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card';
            card.style.borderLeftColor = player.color;

            card.innerHTML = `
                <div class="player-avatar" style="background-color: ${player.color}">
                    ${player.name.charAt(0).toUpperCase()}
                </div>
                <div class="player-name">${player.name}${player.isHost ? ' (Host)' : ''}</div>
            `;

            playersList.appendChild(card);
        });

        const startBtn = document.getElementById('start-game-btn');
        const isHost = players[this.currentPlayerId] && players[this.currentPlayerId].isHost;
        startBtn.disabled = playerCount < this.config.minPlayers || !isHost;
    }

    leaveRoom() {
        if (this.currentRoomRef && this.currentPlayerId) {
            // Remove player from room
            this.currentRoomRef.child('players/' + this.currentPlayerId).remove();
            this.currentRoomRef.off(); // Remove listeners
        }
        this.resetLocalState();
        this.showScreen('welcome');
    }

    resetLocalState() {
        this.currentRoomId = null;
        this.currentPlayerId = null;
        this.currentRoomRef = null;
        this.clearTimer();
    }

    // Game logic with Firebase
    startGame() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.update({
            gameStarted: true,
            currentRound: 1,
            currentHolderIndex: 0,
            roundPhase: 'choosing'
        });
    }

    updateGameDisplay(roomData) {
        const players = roomData.players || {};
        const playersArray = Object.values(players);

        document.getElementById('current-round').textContent = roomData.currentRound || 1;

        const currentHolder = playersArray[roomData.currentHolderIndex || 0];
        if (currentHolder) {
            document.getElementById('holder-name').textContent = currentHolder.name;
        }

        const phaseTexts = {
            'choosing': 'is choosing which hand holds the wee...',
            'voting': 'Vote for which hand has the wee!',
            'results': 'Round complete!'
        };

        document.getElementById('holder-instruction').textContent = 
            phaseTexts[roomData.roundPhase] || '';

        // Show appropriate view based on phase and player role
        const isCurrentHolder = currentHolder && currentHolder.id === this.currentPlayerId;

        if (roomData.roundPhase === 'choosing') {
            if (isCurrentHolder) {
                this.showHolderView();
            } else {
                this.showWaitingView();
            }
        } else if (roomData.roundPhase === 'voting') {
            if (!isCurrentHolder) {
                this.showVotingView();
                this.startTimer(this.config.votingTime);
            } else {
                this.showWaitingView();
            }
        } else if (roomData.roundPhase === 'results') {
            this.showResultsView(roomData);
        }

        this.updateScoreboard(playersArray);
    }

    showHolderView() {
        document.getElementById('holder-view').classList.remove('hidden');
        document.getElementById('voting-view').classList.add('hidden');
        document.getElementById('results-view').classList.add('hidden');
    }

    showWaitingView() {
        document.getElementById('holder-view').classList.add('hidden');
        document.getElementById('voting-view').classList.add('hidden');
        document.getElementById('results-view').classList.add('hidden');
    }

    showVotingView() {
        document.getElementById('holder-view').classList.add('hidden');
        document.getElementById('voting-view').classList.remove('hidden');
        document.getElementById('results-view').classList.add('hidden');
    }

    showResultsView(roomData) {
        document.getElementById('holder-view').classList.add('hidden');
        document.getElementById('voting-view').classList.add('hidden');
        document.getElementById('results-view').classList.remove('hidden');

        if (roomData.stickChoice) {
            const handName = roomData.stickChoice === 'left' ? 'Camiq (Left)' : 'Taliq (Right)';
            document.getElementById('correct-hand').textContent = handName;
        }

        this.updateVoteSummary(roomData.votes || {});
        this.clearTimer();
    }

    makeStickChoice(choice) {
        if (!this.currentRoomRef || !choice) return;

        document.querySelectorAll('.hand-btn[data-choice]').forEach(btn => {
            btn.classList.remove('selected');
        });
        const selectedBtn = document.querySelector(`[data-choice="${choice}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }

        // Update Firebase with choice and move to voting phase
        setTimeout(() => {
            this.currentRoomRef.update({
                stickChoice: choice,
                roundPhase: 'voting',
                votes: {} // Clear previous votes
            });
        }, 1000);
    }

    castVote(vote) {
        if (!this.currentRoomRef || !this.currentPlayerId || !vote) return;

        document.querySelectorAll('.hand-btn[data-vote]').forEach(btn => {
            btn.classList.remove('selected');
        });
        const selectedBtn = document.querySelector(`[data-vote="${vote}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }

        // Submit vote to Firebase
        this.currentRoomRef.child('votes/' + this.currentPlayerId).set(vote);

        // Check if all players have voted
        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            const players = roomData.players || {};
            const votes = roomData.votes || {};

            // Count non-holder players
            const playersArray = Object.values(players);
            const currentHolder = playersArray[roomData.currentHolderIndex || 0];
            const votingPlayers = playersArray.filter(p => p.id !== currentHolder.id);

            if (Object.keys(votes).length === votingPlayers.length) {
                this.calculateAndShowResults(roomData);
            }
        }).catch((error) => {
            console.error('Error checking votes:', error);
        });
    }

    calculateAndShowResults(roomData) {
        const players = roomData.players || {};
        const votes = roomData.votes || {};
        const correctHand = roomData.stickChoice;
        const playersArray = Object.values(players);
        const currentHolder = playersArray[roomData.currentHolderIndex || 0];

        let correctGuesses = 0;
        const updatedPlayers = { ...players };

        // Count correct guesses and award points
        Object.entries(votes).forEach(([playerId, vote]) => {
            if (vote === correctHand) {
                correctGuesses++;
                updatedPlayers[playerId].score += 1;
            }
        });

        // Award points to holder if less than half guessed correctly
        if (correctGuesses < Object.keys(votes).length / 2) {
            updatedPlayers[currentHolder.id].score += 1;
        }

        // Update Firebase with new scores and results phase
        this.currentRoomRef.update({
            players: updatedPlayers,
            roundPhase: 'results'
        });
    }

    nextRound() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            const playersArray = Object.values(roomData.players || {});
            const nextRound = (roomData.currentRound || 1) + 1;
            const nextHolderIndex = ((roomData.currentHolderIndex || 0) + 1) % playersArray.length;

            // Check if game should end (everyone has been holder once)
            if (nextRound > playersArray.length) {
                this.endGame(roomData);
            } else {
                this.currentRoomRef.update({
                    currentRound: nextRound,
                    currentHolderIndex: nextHolderIndex,
                    roundPhase: 'choosing',
                    stickChoice: null,
                    votes: {}
                });
            }
        }).catch((error) => {
            console.error('Error advancing round:', error);
        });
    }

    endGame(roomData) {
        const playersArray = Object.values(roomData.players || {});
        const winner = playersArray.reduce((prev, current) => 
            prev.score > current.score ? prev : current
        );

        this.currentRoomRef.update({
            gameEnded: true,
            winner: winner
        });
    }

    showEndScreen(roomData) {
        const winner = roomData.winner;
        if (winner) {
            document.getElementById('winner-display').textContent = 
                `${winner.name} wins with ${winner.score} points!`;
        }

        // Show final scores
        const finalScores = document.getElementById('final-scores');
        finalScores.innerHTML = '';

        const playersArray = Object.values(roomData.players || {});
        const sortedPlayers = playersArray.sort((a, b) => b.score - a.score);

        sortedPlayers.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'score-item';
            item.innerHTML = `
                <span>${index + 1}. ${player.name}</span>
                <span>${player.score} points</span>
            `;
            finalScores.appendChild(item);
        });

        this.showScreen('end-screen');
    }

    updateVoteSummary(votes) {
        const summary = document.getElementById('vote-summary');
        if (!summary) return;

        summary.innerHTML = '';

        const leftVotes = Object.values(votes).filter(v => v === 'left').length;
        const rightVotes = Object.values(votes).filter(v => v === 'right').length;

        summary.innerHTML = `
            <div class="vote-item">
                <span>Camiq (Left):</span>
                <span>${leftVotes} votes</span>
            </div>
            <div class="vote-item">
                <span>Taliq (Right):</span>
                <span>${rightVotes} votes</span>
            </div>
        `;
    }

    updateScoreboard(playersArray) {
        const scoresList = document.getElementById('scores-list');
        if (!scoresList) return;

        scoresList.innerHTML = '';

        // Sort players by score
        const sortedPlayers = [...playersArray].sort((a, b) => b.score - a.score);

        sortedPlayers.forEach(player => {
            const item = document.createElement('div');
            item.className = 'score-item';
            item.innerHTML = `
                <span>${player.name}</span>
                <span class="player-score">${player.score}</span>
            `;
            scoresList.appendChild(item);
        });
    }

    resetGame() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            if (!roomData) return;

            const updatedPlayers = {};

            // Reset all player scores
            Object.entries(roomData.players || {}).forEach(([id, player]) => {
                updatedPlayers[id] = { ...player, score: 0 };
            });

            this.currentRoomRef.update({
                gameStarted: false,
                gameEnded: false,
                currentRound: 1,
                currentHolderIndex: 0,
                roundPhase: 'waiting',
                stickChoice: null,
                votes: {},
                players: updatedPlayers,
                winner: null
            });

            this.showScreen('lobby');
        }).catch((error) => {
            console.error('Error resetting game:', error);
        });
    }

    startTimer(seconds) {
        this.clearTimer();
        this.timeRemaining = seconds;
        this.updateTimerDisplay();

        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.clearTimer();
            }
        }, 1000);
    }

    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    updateTimerDisplay() {
        const display = document.getElementById('timer-display');
        if (display) {
            if (this.timeRemaining > 0) {
                display.textContent = `${this.timeRemaining}s`;
            } else {
                display.textContent = '';
            }
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        const game = new KaataqGame();
    } catch (error) {
        console.error('Error initializing game:', error);
    }
});
