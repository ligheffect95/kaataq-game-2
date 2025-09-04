// Firebase-Enabled Kaataq Game Implementation with AI Bot Support
class KaataqGame {
    constructor() {
        // Local UI state (not synced)
        this.gameState = 'welcome';
        this.currentPlayerId = null;
        this.currentRoomId = null;
        this.timer = null;
        this.timeRemaining = 0;
        this.gameHistory = []; // Track game history for bot AI
        this.botActionTimeouts = new Map(); // Track bot action timeouts

        // Firebase database reference
        this.database = firebase.database();
        this.currentRoomRef = null;

        // Updated config with bot support
        this.config = {
            minPlayers: 2, // CHANGED: Reduced from 3 to 2
            maxPlayers: 8,
            discussionTime: 45,
            votingTime: 30,
            maxBots: 6 // Maximum number of bots allowed
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
        
        // Ensure bot AI is available
        if (typeof window.botAI === 'undefined') {
            console.error('Bot AI not loaded! Make sure to include bot-ai.js');
        }
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

        // NEW: Bot management buttons
        document.getElementById('add-bot-btn').addEventListener('click', () => {
            this.addBot();
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

    // NEW: Bot Management Methods
    addBot() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            if (!roomData) return;

            const players = roomData.players || {};
            const playerCount = Object.keys(players).length;
            const botCount = Object.values(players).filter(p => p.isBot).length;

            // Check limits
            if (playerCount >= this.config.maxPlayers) {
                this.showToast('Room is full!', 'error');
                return;
            }

            if (botCount >= this.config.maxBots) {
                this.showToast('Maximum number of bots reached!', 'error');
                return;
            }

            // Generate bot using bot AI
            const bot = window.botAI.generateBot(this.currentPlayerId, playerCount);
            
            // Add bot to Firebase
            const botRef = this.currentRoomRef.child('players/' + bot.id);
            botRef.set(bot).then(() => {
                this.showToast(`Bot ${bot.name} added!`, 'success');
            }).catch((error) => {
                console.error('Error adding bot:', error);
                this.showToast('Error adding bot: ' + error.message, 'error');
            });
        });
    }

    removeBot(botId) {
        if (!this.currentRoomRef) return;
        
        // Check if current user is host
        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            if (!roomData || roomData.host !== this.currentPlayerId) {
                this.showToast('Only the host can remove bots!', 'error');
                return;
            }

            const bot = roomData.players[botId];
            if (!bot || !bot.isBot) {
                this.showToast('Invalid bot!', 'error');
                return;
            }

            // Remove bot name from used names
            window.botAI.removeBotName(bot.name);

            // Remove bot from Firebase
            this.currentRoomRef.child('players/' + botId).remove().then(() => {
                this.showToast(`Bot ${bot.name} removed!`, 'success');
                
                // Clear any pending bot actions
                if (this.botActionTimeouts.has(botId)) {
                    clearTimeout(this.botActionTimeouts.get(botId));
                    this.botActionTimeouts.delete(botId);
                }
            }).catch((error) => {
                console.error('Error removing bot:', error);
                this.showToast('Error removing bot: ' + error.message, 'error');
            });
        });
    }

    // Room management with Firebase (Updated for bots)
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
                    isHost: true,
                    isBot: false // NEW: Mark as human player
                }
            },
            votes: {},
            gameHistory: [], // NEW: Track history for bot AI
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
                isHost: false,
                isBot: false // NEW: Mark as human player
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
            this.gameHistory = roomData.gameHistory || [];
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
            this.handleBotActions(roomData); // NEW: Handle bot AI actions
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
            if (player.isBot) {
                card.classList.add('bot-player'); // NEW: Add bot styling class
            }
            card.style.borderLeftColor = player.color;

            // NEW: Create bot controls for host
            const isHost = roomData.host === this.currentPlayerId;
            const kickButton = (player.isBot && isHost) ? 
                `<button class="kick-bot-btn" onclick="game.removeBot('${player.id}')">✕</button>` : '';

            card.innerHTML = `
                <div class="player-avatar" style="background-color: ${player.color}">
                    ${player.name.charAt(0)}
                </div>
                <div class="player-info">
                    <div class="player-name">
                        ${player.name}
                        ${player.isHost ? ' (Host)' : ''}
                        ${player.isBot ? ` (${player.botDifficulty.toUpperCase()})` : ''}
                    </div>
                </div>
                <div class="player-score">${player.score}</div>
                ${kickButton}
            `;
            playersList.appendChild(card);
        });

        // Update start button and bot controls
        const startBtn = document.getElementById('start-game-btn');
        const addBotBtn = document.getElementById('add-bot-btn');
        const isHost = roomData.host === this.currentPlayerId;

        startBtn.disabled = playerCount < this.config.minPlayers || !isHost;
        
        // Show/hide bot controls based on host status
        if (addBotBtn) {
            addBotBtn.style.display = isHost ? 'block' : 'none';
            addBotBtn.disabled = playerCount >= this.config.maxPlayers;
        }
    }

    // NEW: Handle bot AI actions during gameplay
    handleBotActions(roomData) {
        if (!roomData.gameStarted) return;

        const players = roomData.players || {};
        const currentPlayer = Object.values(players)[roomData.currentHolderIndex];

        // Only the host manages bot actions to prevent conflicts
        if (roomData.host !== this.currentPlayerId) return;

        if (roomData.roundPhase === 'stick_choice' && currentPlayer?.isBot) {
            // Bot needs to make stick choice
            if (!roomData.stickChoice && !this.botActionTimeouts.has(currentPlayer.id)) {
                const timeout = setTimeout(async () => {
                    try {
                        const choice = await window.botAI.makeStickChoice(currentPlayer, this.gameHistory);
                        this.currentRoomRef.update({
                            stickChoice: choice,
                            roundPhase: 'voting'
                        });
                        this.startTimer(this.config.votingTime);
                    } catch (error) {
                        console.error('Bot stick choice error:', error);
                    }
                    this.botActionTimeouts.delete(currentPlayer.id);
                }, 500);
                
                this.botActionTimeouts.set(currentPlayer.id, timeout);
            }
        } else if (roomData.roundPhase === 'voting') {
            // Bots need to vote
            const votes = roomData.votes || {};
            Object.values(players).forEach(player => {
                if (player.isBot && !votes[player.id] && player.id !== currentPlayer?.id) {
                    if (!this.botActionTimeouts.has(player.id + '_vote')) {
                        const timeout = setTimeout(async () => {
                            try {
                                const guess = await window.botAI.makeGuess(
                                    player, 
                                    currentPlayer, 
                                    this.gameHistory, 
                                    votes
                                );
                                this.currentRoomRef.child('votes/' + player.id).set(guess);
                            } catch (error) {
                                console.error('Bot vote error:', error);
                            }
                            this.botActionTimeouts.delete(player.id + '_vote');
                        }, Math.random() * 3000 + 1000);
                        
                        this.botActionTimeouts.set(player.id + '_vote', timeout);
                    }
                }
            });
        }
    }

    startGame() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            if (!roomData || roomData.host !== this.currentPlayerId) return;

            const playerCount = Object.keys(roomData.players || {}).length;
            if (playerCount < this.config.minPlayers) {
                this.showToast(`Need at least ${this.config.minPlayers} players to start!`, 'error');
                return;
            }

            this.currentRoomRef.update({
                gameStarted: true,
                roundPhase: 'stick_choice'
            }).then(() => {
                this.startTimer(this.config.discussionTime);
            });
        });
    }

    updateGameDisplay(roomData) {
        if (!roomData.gameStarted) return;

        const players = roomData.players || {};
        const playersList = Object.values(players);
        const currentPlayer = playersList[roomData.currentHolderIndex];

        // Update round info
        document.getElementById('round-number').textContent = roomData.currentRound;
        document.getElementById('current-holder').textContent = currentPlayer?.name || 'Unknown';

        // Update current holder display
        const holderDisplay = document.getElementById('current-holder-display');
        if (holderDisplay && currentPlayer) {
            holderDisplay.innerHTML = `
                <div class="holder-info">
                    <div class="holder-avatar" style="background-color: ${currentPlayer.color}">
                        ${currentPlayer.name.charAt(0)}
                    </div>
                    <div class="holder-name">${currentPlayer.name}</div>
                    ${currentPlayer.isBot ? `<div class="bot-indicator">🤖 ${currentPlayer.botDifficulty.toUpperCase()}</div>` : ''}
                </div>
            `;
        }

        // Show/hide controls based on phase and player
        this.updateGameControls(roomData, currentPlayer);
        this.updatePlayersList(roomData);
    }

    updateGameControls(roomData, currentPlayer) {
        const isCurrentPlayer = currentPlayer?.id === this.currentPlayerId;
        const stickChoiceDiv = document.getElementById('stick-choice');
        const votingDiv = document.getElementById('voting-controls');
        const waitingDiv = document.getElementById('waiting-area');

        // Hide all controls first
        [stickChoiceDiv, votingDiv, waitingDiv].forEach(div => {
            if (div) div.style.display = 'none';
        });

        if (roomData.roundPhase === 'stick_choice') {
            if (isCurrentPlayer && !currentPlayer.isBot) {
                if (stickChoiceDiv) stickChoiceDiv.style.display = 'block';
            } else {
                if (waitingDiv) {
                    waitingDiv.style.display = 'block';
                    waitingDiv.innerHTML = `
                        <p>${currentPlayer?.name} is choosing which hand holds the wee...</p>
                        ${currentPlayer?.isBot ? '<p class="bot-thinking">🤖 Bot is thinking...</p>' : ''}
                    `;
                }
            }
        } else if (roomData.roundPhase === 'voting') {
            if (!isCurrentPlayer) {
                const hasVoted = (roomData.votes || {})[this.currentPlayerId];
                if (!hasVoted && votingDiv) {
                    votingDiv.style.display = 'block';
                }
            }
            
            if (waitingDiv) {
                waitingDiv.style.display = 'block';
                const votes = Object.keys(roomData.votes || {}).length;
                const totalVoters = Object.values(roomData.players || {}).length - 1; // Exclude holder
                waitingDiv.innerHTML = `
                    <p>Votes received: ${votes}/${totalVoters}</p>
                    <div class="vote-progress">
                        <div class="vote-bar" style="width: ${(votes/totalVoters)*100}%"></div>
                    </div>
                `;
            }
        }
    }

    updatePlayersList(roomData) {
        const playersListGame = document.getElementById('players-list-game');
        if (!playersListGame) return;

        const players = roomData.players || {};
        playersListGame.innerHTML = '';

        Object.values(players).forEach(player => {
            const card = document.createElement('div');
            card.className = 'player-card-game';
            if (player.isBot) {
                card.classList.add('bot-player');
            }

            const hasVoted = (roomData.votes || {})[player.id] ? '✓' : '';
            card.innerHTML = `
                <div class="player-avatar-small" style="background-color: ${player.color}">
                    ${player.name.charAt(0)}
                </div>
                <div class="player-name-small">
                    ${player.name}
                    ${player.isBot ? ' 🤖' : ''}
                </div>
                <div class="player-score-small">${player.score}</div>
                <div class="vote-status">${hasVoted}</div>
            `;
            playersListGame.appendChild(card);
        });
    }

    makeStickChoice(choice) {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.update({
            stickChoice: choice,
            roundPhase: 'voting'
        }).then(() => {
            this.startTimer(this.config.votingTime);
        });
    }

    castVote(vote) {
        if (!this.currentRoomRef || !this.currentPlayerId) return;

        this.currentRoomRef.child('votes/' + this.currentPlayerId).set(vote);
    }

    startTimer(seconds) {
        this.timeRemaining = seconds;
        this.updateTimerDisplay();

        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                clearInterval(this.timer);
                this.handleTimeUp();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const timerDisplay = document.getElementById('timer');
        if (timerDisplay) {
            timerDisplay.textContent = this.timeRemaining;
        }
    }

    handleTimeUp() {
        // Auto-proceed to results when time is up
        this.showResults();
    }

    showResults() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            if (!roomData) return;

            const players = roomData.players || {};
            const votes = roomData.votes || {};
            const currentPlayer = Object.values(players)[roomData.currentHolderIndex];
            const stickChoice = roomData.stickChoice;

            // Calculate results
            const leftVotes = Object.values(votes).filter(v => v === 'left').length;
            const rightVotes = Object.values(votes).filter(v => v === 'right').length;
            const correctGuessers = Object.keys(votes).filter(playerId => votes[playerId] === stickChoice);

            // Update scores
            const updates = {};
            
            // Holder gets points if fewer than half guessed correctly
            const totalVotes = leftVotes + rightVotes;
            if (correctGuessers.length < totalVotes / 2) {
                updates[`players/${currentPlayer.id}/score`] = (players[currentPlayer.id].score || 0) + 1;
            }

            // Correct guessers get points
            correctGuessers.forEach(playerId => {
                if (playerId !== currentPlayer.id) {
                    updates[`players/${playerId}/score`] = (players[playerId].score || 0) + 1;
                }
            });

            // Add to game history for bot AI
            const roundResult = {
                round: roomData.currentRound,
                holderId: currentPlayer.id,
                holderName: currentPlayer.name,
                stickChoice: stickChoice,
                votes: votes,
                correctGuessers: correctGuessers,
                timestamp: Date.now()
            };
            updates[`gameHistory/${roomData.currentRound - 1}`] = roundResult;

            // Update round phase
            updates.roundPhase = 'results';
            updates.votes = {};

            this.currentRoomRef.update(updates).then(() => {
                this.displayResults(roomData, stickChoice, leftVotes, rightVotes, correctGuessers);
            });
        });
    }

    displayResults(roomData, stickChoice, leftVotes, rightVotes, correctGuessers) {
        const resultsDiv = document.getElementById('results-display');
        if (!resultsDiv) return;

        const players = roomData.players || {};
        const currentPlayer = Object.values(players)[roomData.currentHolderIndex];

        resultsDiv.innerHTML = `
            <div class="round-results">
                <h3>Round ${roomData.currentRound} Results</h3>
                <div class="stick-reveal">
                    <p>The wee was in the <strong>${stickChoice}</strong> hand!</p>
                </div>
                <div class="vote-summary">
                    <p>Left: ${leftVotes} votes | Right: ${rightVotes} votes</p>
                </div>
                <div class="correct-guessers">
                    <p>Correct guessers: ${correctGuessers.map(id => players[id]?.name).join(', ') || 'None'}</p>
                </div>
            </div>
        `;

        resultsDiv.style.display = 'block';

        // Show next round button after delay
        setTimeout(() => {
            const nextBtn = document.getElementById('next-round-btn');
            if (nextBtn) nextBtn.style.display = 'block';
        }, 3000);
    }

    nextRound() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            if (!roomData) return;

            const players = Object.values(roomData.players || {});
            const nextHolderIndex = (roomData.currentHolderIndex + 1) % players.length;
            const maxScore = Math.max(...players.map(p => p.score || 0));

            // Check for game end (first to 5 points or after 10 rounds)
            if (maxScore >= 5 || roomData.currentRound >= 10) {
                this.endGame();
                return;
            }

            // Start next round
            this.currentRoomRef.update({
                currentRound: roomData.currentRound + 1,
                currentHolderIndex: nextHolderIndex,
                roundPhase: 'stick_choice',
                stickChoice: null,
                votes: {}
            }).then(() => {
                // Hide results and next button
                const resultsDiv = document.getElementById('results-display');
                const nextBtn = document.getElementById('next-round-btn');
                if (resultsDiv) resultsDiv.style.display = 'none';
                if (nextBtn) nextBtn.style.display = 'none';

                this.startTimer(this.config.discussionTime);
            });
        });
    }

    endGame() {
        if (!this.currentRoomRef) return;

        this.currentRoomRef.update({
            gameEnded: true,
            roundPhase: 'finished'
        });
    }

    showEndScreen(roomData) {
        this.showScreen('end-screen');

        const players = Object.values(roomData.players || {});
        const sortedPlayers = players.sort((a, b) => (b.score || 0) - (a.score || 0));
        const winner = sortedPlayers[0];

        document.getElementById('winner-name').textContent = winner?.name || 'Unknown';

        const finalScores = document.getElementById('final-scores');
        if (finalScores) {
            finalScores.innerHTML = sortedPlayers.map((player, index) => `
                <div class="score-item ${player.isBot ? 'bot-player' : ''}">
                    <span>${index + 1}. ${player.name} ${player.isBot ? '🤖' : ''}</span>
                    <span>${player.score || 0} points</span>
                </div>
            `).join('');
        }

        // Clear all bot timeouts
        this.botActionTimeouts.forEach(timeout => clearTimeout(timeout));
        this.botActionTimeouts.clear();
    }

    resetGame() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        // Clear bot timeouts
        this.botActionTimeouts.forEach(timeout => clearTimeout(timeout));
        this.botActionTimeouts.clear();

        if (!this.currentRoomRef) return;

        this.currentRoomRef.once('value').then((snapshot) => {
            const roomData = snapshot.val();
            if (!roomData || roomData.host !== this.currentPlayerId) return;

            // Reset scores but keep players
            const updates = {};
            Object.keys(roomData.players || {}).forEach(playerId => {
                updates[`players/${playerId}/score`] = 0;
            });

            updates.gameStarted = false;
            updates.gameEnded = false;
            updates.currentRound = 1;
            updates.currentHolderIndex = 0;
            updates.roundPhase = 'waiting';
            updates.stickChoice = null;
            updates.votes = {};
            updates.gameHistory = [];

            this.currentRoomRef.update(updates).then(() => {
                this.showScreen('lobby');
            });
        });
    }

    leaveRoom() {
        if (this.currentRoomRef && this.currentPlayerId) {
            // Remove player from room
            this.currentRoomRef.child('players/' + this.currentPlayerId).remove();
            
            // Clean up listeners
            this.currentRoomRef.off();
            this.currentRoomRef = null;
            this.currentRoomId = null;
            this.currentPlayerId = null;
        }

        // Clear timers and bot actions
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.botActionTimeouts.forEach(timeout => clearTimeout(timeout));
        this.botActionTimeouts.clear();

        this.showScreen('welcome');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new KaataqGame();
});
