# Kaataq - Lenten Alutiiq Game

A digital adaptation of the traditional Alutiiq stick guessing game, designed as a mobile-friendly multiplayer experience for my IASA SEAPAVAA 2025 conference/workshop icebreaker and broader cultural education.

## About the Game

Kaataq is a traditional Alutiiq guessing game involving psychological gameplay and social interaction. Players take turns hiding a marked stick (wee) in one of their hands, while others try to guess which hand contains it. This digital version preserves the cultural essence while adding modern multiplayer functionality.

## Features

- **Real multiplayer**: Cross-device gameplay using Firebase Realtime Database
- **Room-based system**: Create or join games with 4-digit codes
- **Cultural education**: Integrated information about Alutiiq traditions and language
- **Mobile-responsive**: Optimized for phones and tablets
- **Real-time sync**: All players see actions instantly
- **Authentic terminology**: Uses traditional Alutiiq words (Camiq/left, Taliq/right, wee/dip)

## How to Play

1. **Create or join a room** using a 4-digit code
2. **Wait for players** (3-8 players required)
3. **Take turns as Stick Holder** - choose which hand holds the "wee"
4. **Other players vote** on which hand they think has the marked stick
5. **Score points** for correct guesses or successful bluffing
6. **Game ends** after everyone has been the Stick Holder once

## Cultural Context

This game is based on traditional Alutiiq/Sugpiaq gaming practices, specifically the stick guessing game Kaataq which was brought from the southeast via the fur trade, according to the Alutiiq Museum. The cultural information is sourced from the Alutiiq Museum and Archaeological Repository to ensure authenticity and respect for the traditions.

**Traditional Terms Used:**
- **Kaataq**: The stick game itself
- **Wee**: The marked stick (Still unsure if this and dip are sugt'stun words or were borrowed)
- **Dip**: The unmarked stick  
- **Camiq**: Left hand
- **Taliq**: Right hand

I am not Alutiiq, I am an Orthodox Christian who was raised with a deep appreciation for their culture, and their contributions to my religion.


## Technical Setup

### Firebase Configuration
This game uses Firebase Realtime Database for multiplayer functionality. The configuration is included in the code for the `kaataq-game` project.

### Deployment
1. Upload all files to your GitHub repository
2. Enable GitHub Pages in repository settings
3. Your game will be available at: `https://[username].github.io/[repository-name]`

### Files Structure
- `index.html` - Main game interface
- `styles.css` - Responsive styling with Alutiiq-inspired design
- `game.js` - Firebase-enabled multiplayer game logic
- `README.md` - This documentation

## Browser Compatibility
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## Privacy & Data
- No personal information is stored permanently
- Room data is automatically cleaned up
- All communication happens through Firebase's secure infrastructure

## Credits
- Cultural information sourced from the Alutiiq Museum and Archaeological Repository
- Game design inspired by traditional Alutiiq Kaataq
- Built for educational and cultural preservation purposes

---

*This digital adaptation is created with respect for Alutiiq cultural traditions and is intended for educational use.*
