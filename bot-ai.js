// Bot AI Logic for Kaataq Game
// Handles decision-making for AI players with different difficulty levels

class BotAI {
    constructor() {
        this.botNames = [
            'Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 
            'Grace', 'Henry', 'Iris', 'Jack', 'Kate', 'Liam'
        ];
        this.usedNames = new Set();
        this.difficulties = ['easy', 'medium', 'hard'];
    }

    // Generate a unique bot player object
    generateBot(hostId, playerCount) {
        const availableNames = this.botNames.filter(name => !this.usedNames.has(name));
        if (availableNames.length === 0) {
            // Reset if all names used
            this.usedNames.clear();
        }
        
        const name = availableNames.length > 0 ? 
            availableNames[Math.floor(Math.random() * availableNames.length)] :
            'Bot' + Math.floor(Math.random() * 1000);
        
        this.usedNames.add(name);
        
        const difficulty = this.difficulties[Math.floor(Math.random() * this.difficulties.length)];
        
        return {
            id: 'bot_' + Math.random().toString(36).substr(2, 9),
            name: `🤖 ${name}`,
            score: 0,
            color: this.getRandomColor(playerCount),
            isHost: false,
            isBot: true,
            botDifficulty: difficulty,
            botPersonality: this.generatePersonality(difficulty)
        };
    }

    getRandomColor(playerCount) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
        ];
        return colors[playerCount % colors.length];
    }

    // Generate bot personality traits based on difficulty
    generatePersonality(difficulty) {
        const personalities = {
            easy: {
                bluffChance: 0.3,
                smartGuessChance: 0.2,
                consistency: 0.4,
                reactionTime: { min: 1000, max: 3000 }
            },
            medium: {
                bluffChance: 0.5,
                smartGuessChance: 0.6,
                consistency: 0.7,
                reactionTime: { min: 800, max: 2500 }
            },
            hard: {
                bluffChance: 0.7,
                smartGuessChance: 0.8,
                consistency: 0.9,
                reactionTime: { min: 500, max: 2000 }
            }
        };
        return personalities[difficulty];
    }

    // Bot decides which hand to hide the stick in (as holder)
    makeStickChoice(botPlayer, gameHistory = []) {
        const personality = botPlayer.botPersonality;
        
        return new Promise((resolve) => {
            // Simulate thinking time
            const thinkTime = Math.random() * 
                (personality.reactionTime.max - personality.reactionTime.min) + 
                personality.reactionTime.min;
            
            setTimeout(() => {
                let choice;
                
                if (Math.random() < personality.consistency) {
                    // Use strategy based on difficulty
                    if (botPlayer.botDifficulty === 'hard') {
                        choice = this.makeStrategicStickChoice(gameHistory);
                    } else if (botPlayer.botDifficulty === 'medium') {
                        choice = this.makeMediumStickChoice(gameHistory);
                    } else {
                        choice = Math.random() < 0.5 ? 'left' : 'right';
                    }
                } else {
                    // Random choice (inconsistency)
                    choice = Math.random() < 0.5 ? 'left' : 'right';
                }
                
                resolve(choice);
            }, thinkTime);
        });
    }

    // Bot makes a guess about which hand holds the stick
    makeGuess(botPlayer, holderPlayer, gameHistory = [], currentVotes = {}) {
        const personality = botPlayer.botPersonality;
        
        return new Promise((resolve) => {
            // Simulate thinking time
            const thinkTime = Math.random() * 
                (personality.reactionTime.max - personality.reactionTime.min) + 
                personality.reactionTime.min;
            
            setTimeout(() => {
                let guess;
                
                if (Math.random() < personality.smartGuessChance) {
                    // Use strategy based on difficulty
                    if (botPlayer.botDifficulty === 'hard') {
                        guess = this.makeStrategicGuess(holderPlayer, gameHistory, currentVotes);
                    } else if (botPlayer.botDifficulty === 'medium') {
                        guess = this.makeMediumGuess(holderPlayer, gameHistory, currentVotes);
                    } else {
                        guess = Math.random() < 0.5 ? 'left' : 'right';
                    }
                } else {
                    // Random guess
                    guess = Math.random() < 0.5 ? 'left' : 'right';
                }
                
                resolve(guess);
            }, thinkTime);
        });
    }

    // Strategic stick placement for hard bots
    makeStrategicStickChoice(gameHistory) {
        if (gameHistory.length === 0) {
            return Math.random() < 0.5 ? 'left' : 'right';
        }
        
        // Analyze recent patterns and avoid them
        const recentChoices = gameHistory.slice(-3);
        const leftCount = recentChoices.filter(h => h.stickChoice === 'left').length;
        const rightCount = recentChoices.length - leftCount;
        
        // Favor the less common choice
        if (leftCount > rightCount) {
            return Math.random() < 0.7 ? 'right' : 'left';
        } else if (rightCount > leftCount) {
            return Math.random() < 0.7 ? 'left' : 'right';
        } else {
            return Math.random() < 0.5 ? 'left' : 'right';
        }
    }

    // Medium strategy for stick placement
    makeMediumStickChoice(gameHistory) {
        if (gameHistory.length === 0) {
            return Math.random() < 0.5 ? 'left' : 'right';
        }
        
        // Simple pattern avoidance
        const lastChoice = gameHistory[gameHistory.length - 1]?.stickChoice;
        if (lastChoice && Math.random() < 0.6) {
            return lastChoice === 'left' ? 'right' : 'left';
        }
        
        return Math.random() < 0.5 ? 'left' : 'right';
    }

    // Strategic guessing for hard bots
    makeStrategicGuess(holderPlayer, gameHistory, currentVotes) {
        // Analyze holder's patterns
        const holderHistory = gameHistory.filter(h => h.holderId === holderPlayer.id);
        
        if (holderHistory.length > 0) {
            const leftCount = holderHistory.filter(h => h.stickChoice === 'left').length;
            const rightCount = holderHistory.length - leftCount;
            
            // Predict based on pattern
            if (leftCount > rightCount * 1.5) {
                return Math.random() < 0.7 ? 'left' : 'right';
            } else if (rightCount > leftCount * 1.5) {
                return Math.random() < 0.7 ? 'right' : 'left';
            }
        }
        
        // Consider other players' votes (social pressure)
        const votes = Object.values(currentVotes);
        const leftVotes = votes.filter(v => v === 'left').length;
        const rightVotes = votes.filter(v => v === 'right').length;
        
        if (leftVotes > rightVotes && Math.random() < 0.4) {
            return 'left'; // Sometimes follow the crowd
        } else if (rightVotes > leftVotes && Math.random() < 0.4) {
            return 'right';
        }
        
        return Math.random() < 0.5 ? 'left' : 'right';
    }

    // Medium strategy for guessing
    makeMediumGuess(holderPlayer, gameHistory, currentVotes) {
        // Simple pattern recognition
        const holderHistory = gameHistory.filter(h => h.holderId === holderPlayer.id);
        
        if (holderHistory.length > 1) {
            const lastChoice = holderHistory[holderHistory.length - 1]?.stickChoice;
            if (lastChoice && Math.random() < 0.5) {
                // Sometimes predict they'll switch
                return lastChoice === 'left' ? 'right' : 'left';
            }
        }
        
        return Math.random() < 0.5 ? 'left' : 'right';
    }

    // Remove bot name from used names when bot is removed
    removeBotName(botName) {
        const cleanName = botName.replace('🤖 ', '');
        this.usedNames.delete(cleanName);
    }
}

// Global bot AI instance
window.botAI = new BotAI();