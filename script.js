// --- AUDIO INITIALIZATION ---
let audioCtx;
let isMuted = false;
let instructionTimer = null;
let isPaused = false;
let leaderboard = JSON.parse(localStorage.getItem('jackpot-leaderboard') || 'null') || [
    { name: 'Liyana', country: 'MY', score: 4 }
];


// Show Instructions in Pause Mode
function showInstructionModal() {
    const modal = document.getElementById('instruction-modal');
    const modalCat = document.getElementById('modal-cat-preview');
    
    if (modal) {
        if (modalCat) {
            modalCat.src = 'images/oyen.png';
        }
        modal.classList.remove('hidden');
    }
}

// Close popup and unpause/start loop movement
function closeInstructionModal() {
    const modal = document.getElementById('instruction-modal');
    if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
        gameState = 'playing'; // Resume/Start gameplay motion
    }
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Toggle Mute Function
function toggleMute() {
    isMuted = !isMuted;
    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
    }
    const music = document.getElementById('background-music');
    if (music && music.contentWindow) {
        music.contentWindow.postMessage(JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute', args: [] }), '*');
    }
}

function renderLeaderboard() {
    leaderboard.sort((a, b) => b.score - a.score);
    const list = document.getElementById('leaderboard-list');
    if (list) {
        const highestScore = leaderboard[0];
        list.textContent = highestScore
            ? `${highestScore.country} ${highestScore.name} ${highestScore.score}`
            : '';
    }
}

function saveScore() {
    if (!playerName || score <= 0) return;
    leaderboard.push({ name: playerName, country: playerCountry, score });
    localStorage.setItem('jackpot-leaderboard', JSON.stringify(leaderboard));
    renderLeaderboard();
}

function togglePause() {
    if (gameState !== 'playing' && gameState !== 'paused') return;
    isPaused = !isPaused;
    gameState = isPaused ? 'paused' : 'playing';
    const pauseButton = document.getElementById('pause-btn');
    pauseButton.textContent = isPaused ? '▶' : 'Ⅱ';
    const music = document.getElementById('background-music');
    if (music && music.contentWindow) {
        music.contentWindow.postMessage(JSON.stringify({ event: 'command', func: isPaused ? 'pauseVideo' : 'playVideo', args: [] }), '*');
    }
}

// Food Collect Sound (High pitched quick chirp)
function playFoodSFX() {
    if (isMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
}

function playWalkSFX() {
    if (isMuted || !keys.left && !keys.right || frameCount % 18 !== 0) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 120;
    gain.gain.setValueAtTime(0.025, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
}

// Jump Sound (Quick frequency sweep upward)
function playJumpSFX() {
    if (isMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
}

// Game Over Sound (Frequency drops down)
function playGameOverSFX() {
    if (isMuted) return;
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

// Win Fanfare Sound (Triumphant double-beep)
function playWinSFX() {
    if (isMuted) return;
    initAudio();
    const notes = [261.63, 329.63, 392.00, 523.25]; // C, E, G, High C
    notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const startTime = audioCtx.currentTime + (index * 0.1);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0.15, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.12);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + 0.12);
    });
}

// --- GAME SETUP ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Dynamic dimensions
let W = 800;
let H = 400;
let GROUND_Y = 330;
const PLAYER_WIDTH = 32;
const PLAYER_HEIGHT = 32;

// --- DOM ELEMENTS ---
const menuScreen = document.getElementById('menu-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const winScreen = document.getElementById('win-screen');
const hudEl = document.getElementById('hud');
const scoreDisplay = document.getElementById('score-display');
const nameDisplay = document.getElementById('player-name-display');
// const nameInput = document.getElementById('player-name');

// --- GAME STATE ---
let gameState = 'menu';
let score = 0;
let playerName = 'Player';
let playerCountry = '🇯🇵';
let speed = 1.8;
let frameCount = 0;
let level = 1;
let floor = 1;
let isCheering = false;
let deathTimer = 0;

// --- ASSETS ---
const catOrangeImg = new Image();
catOrangeImg.src = 'images/oyen.png';
let catImg = catOrangeImg;

const foodImages = [];
for (let i = 1; i <= 7; i++) {
    const img = new Image();
    img.src = `images/food-${i}.png`;
    foodImages.push(img);
}

const groundImg = new Image();
groundImg.src = 'images/land.png';
const backgroundImg = new Image();
backgroundImg.src = 'images/background.png';
const secondFloorImg = new Image();
secondFloorImg.src = 'images/2nd floor.png';
const accessoryImages = [
    ...foodImages,
    'images/2ndimage.JPG',
    'images/2nd floor.png'
];

const obstacleImages = [
    new Image(),
    new Image(),
    new Image(),
    new Image()
];
obstacleImages[0].src = 'images/obstacle1.png';
obstacleImages[1].src = 'images/obstacle2.png';
obstacleImages[2].src = 'images/awan1.png';
obstacleImages[3].src = 'images/awan2.png';

function isVisualObstacle(img) {
    return img === obstacleImages[2] || img === obstacleImages[3];
}

// --- GAME OBJECTS ---
const player = {
    x: 60,
    y: GROUND_Y - PLAYER_HEIGHT,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    vy: 0,
    gravity: 0.42,
    jumpPower: -14,
    onGround: true,
    frame: 0,
    frameTimer: 0
};

let foods = [];
let obstacles = [];
let floatingTexts = [];

// --- RESIZE LOGIC (Placed after variable declarations) ---
function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;

    const isMobile = window.innerWidth <= 640;
    GROUND_Y = isMobile ? H - 80 : H - 100;

    canvas.width = W;
    canvas.height = H;

    // Keep player anchored to ground on resize
    if (player && player.onGround) {
        player.y = GROUND_Y - player.h;
    }
}

// Initialize canvas resolution
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// --- INPUT ---
const keys = { left: false, right: false, jump: false };

// --- HELPER FUNCTIONS ---
function rectCollide(r1, r2) {
    return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
        r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
}

// --- MAIN GAME LOGIC ---
function update() {
    if (gameState === 'falling') {
        player.vy += player.gravity;
        player.y += player.vy;
        player.frame = 4;
        deathTimer--;
        if (deathTimer <= 0) endGameOver();
        return;
    }
    if (gameState !== 'playing') return;
    frameCount++;
    playWalkSFX();

    if (keys.left) player.x -= 2.6;
    if (keys.right) player.x += 2.6;
    player.x = Math.max(0, Math.min(W - player.w, player.x));

    if (keys.left || keys.right) {
        player.frameTimer++;
        if (player.frameTimer > 6) {
            player.frameTimer = 0;
            player.frame = (player.frame + 1) % 3;
        }
    } else {
        player.frame = 0;
        player.frameTimer = 0;
    }

    if (keys.jump && player.onGround) {
        player.vy = player.jumpPower;
        player.onGround = false;
        playJumpSFX();
    }

    const previousBottom = player.y + player.h;
    player.vy += player.gravity;
    player.y += player.vy;

    const upperFloorY = GROUND_Y - Math.min(132, H * 0.28);
    if (player.vy >= 0 && previousBottom <= upperFloorY && player.y + player.h >= upperFloorY && player.x > W * 0.22 && player.x < W * 0.82) {
        player.y = upperFloorY - player.h;
        player.vy = 0;
        player.onGround = true;
        floor = 2;
    }

    if (player.y >= GROUND_Y - player.h) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        player.onGround = true;
        floor = 1;
    }

    const newLevel = Math.floor(score / 100) + 1;
    if (newLevel > level) {
        level = newLevel;
        speed = 1.8 + (level - 1) * 0.45;
        playWinSFX();
        floatingTexts.push({ x: W / 2, y: H / 2, text: `LEVEL ${level}`, life: 120, maxLife: 120, levelUp: true });
    }
    if (score > leaderboard[0].score && !isCheering) {
        isCheering = true;
        player.frame = 3;
        playWinSFX();
        floatingTexts.push({ x: player.x, y: player.y - 20, text: 'NEW HIGH SCORE!', life: 110, maxLife: 110, levelUp: true });
    }

    if (frameCount % 70 === 0) {
        if (Math.random() < 0.6) {
            const randomFood = foodImages[Math.floor(Math.random() * foodImages.length)];
            const foodW = 32;
            const foodH = 32;
            const useUpperFloor = Math.random() < Math.min(0.2 + level * 0.08, 0.65);
            const yPos = useUpperFloor ? upperFloorY - foodH - 2 : GROUND_Y - foodH - Math.random() * Math.min(80 + level * 10, 130);
            const proposedFood = {
                x: W + 20,
                y: yPos,
                w: foodW,
                h: foodH,
                img: randomFood,
                floor: useUpperFloor ? 2 : 1
            };

            const overlapsObstacle = obstacles.some((obs) => {
                const buffer = 10;
                return (
                    proposedFood.x < obs.x + obs.w + buffer &&
                    proposedFood.x + proposedFood.w > obs.x - buffer &&
                    proposedFood.y < obs.y + obs.h + buffer &&
                    proposedFood.y + proposedFood.h > obs.y - buffer
                );
            });

            if (!overlapsObstacle) {
                foods.push(proposedFood);
            }
        }

        if (Math.random() < Math.min(0.4 + level * 0.04, 0.75)) {
            const obstacleImg = obstacleImages[Math.floor(Math.random() * obstacleImages.length)];
            const obstacleH = isVisualObstacle(obstacleImg) ? 28 : 40;
            const obstacleY = isVisualObstacle(obstacleImg) ? 60 + Math.random() * 120 : GROUND_Y - obstacleH;

            obstacles.push({
                x: W + 20,
                y: obstacleY,
                w: isVisualObstacle(obstacleImg) ? 48 : 32,
                h: obstacleH,
                img: obstacleImg
            });
        }
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= speed;
        if (obstacles[i].x + obstacles[i].w < 0) obstacles.splice(i, 1);
    }
    for (let i = foods.length - 1; i >= 0; i--) {
        foods[i].x -= speed;
        if (foods[i].x + foods[i].w < 0) foods.splice(i, 1);
    }

    for (let obs of obstacles) {
        const safeMargin = 12;
        const playerBox = {
            x: player.x + safeMargin,
            y: player.y + safeMargin,
            w: player.w - safeMargin * 2,
            h: player.h - safeMargin * 2
        };

        if (isVisualObstacle(obs.img)) {
            continue;
        }

        if (rectCollide(playerBox, obs)) {
            gameState = 'falling';
            player.vy = -4;
            deathTimer = 36;
            playGameOverSFX();
            return;
        }
    }

    for (let i = foods.length - 1; i >= 0; i--) {
        const f = foods[i];
        if (rectCollide(player, f)) {
            score += f.floor === 2 ? 10 + level * 2 : 3;
            scoreDisplay.textContent = score;
            playFoodSFX();

            floatingTexts.push({
                x: f.x,
                y: f.y - 10,
                text: `+${f.floor === 2 ? 10 + level * 2 : 3}`,
                life: 45,
                maxLife: 45
            });

            foods.splice(i, 1);

        }
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= ft.levelUp ? 0.7 : 1.5;
        ft.life -= 1;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    if (Math.floor(score / 150) % 2 === 1 && secondFloorImg.complete) {
        ctx.drawImage(secondFloorImg, 0, 0, W, H);
    } else if (backgroundImg.complete) {
        ctx.drawImage(backgroundImg, 0, 0, W, GROUND_Y);
    } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, W, H);
    }

    const upperFloorY = GROUND_Y - Math.min(132, H * 0.28);
    ctx.fillStyle = '#6b4e71';
    ctx.fillRect(W * 0.22, upperFloorY, W * 0.6, 8);

    if (groundImg.complete) {
        ctx.drawImage(groundImg, 0, GROUND_Y, W, H - GROUND_Y);
    } else {
        ctx.fillStyle = '#654321';
        ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
        ctx.fillStyle = '#8B5A2B';
        ctx.fillRect(0, GROUND_Y, W, 5);
    }

    for (let obs of obstacles) {
        if (obs.img && obs.img.complete) {
            ctx.drawImage(obs.img, obs.x, obs.y, obs.w, obs.h);
        } else {
            ctx.fillStyle = '#2d6a2e';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.fillRect(obs.x - 8, obs.y + 10, 8, 6);
            ctx.fillRect(obs.x + obs.w, obs.y + 15, 8, 6);
        }
    }

    for (let f of foods) {
        if (f.img.complete) {
            ctx.drawImage(f.img, f.x, f.y, f.w, f.h);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(f.x, f.y, f.w, f.h);
        }
    }

    if (catImg.complete) {
        ctx.save();
        if (player.frame === 3) {
            ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
            ctx.rotate(Math.sin(frameCount / 3) * 0.15);
            ctx.scale(1.15, 1.15);
            ctx.drawImage(catImg, -player.w / 2, -player.h / 2, player.w, player.h);
        } else if (player.frame === 4) {
            ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
            ctx.rotate(Math.min(1.4, Math.abs(player.vy) * 0.08));
            ctx.globalAlpha = Math.max(0.2, deathTimer / 36);
            ctx.drawImage(catImg, -player.w / 2, -player.h / 2, player.w, player.h);
        } else {
            ctx.drawImage(catImg, player.x, player.y, player.w, player.h);
        }
        ctx.restore();
    } else {
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(player.x, player.y, player.w, player.h);
    }

    ctx.font = '16px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    for (let ft of floatingTexts) {
        ctx.globalAlpha = ft.life / ft.maxLife;
        ctx.fillStyle = ft.levelUp ? '#fff' : '#FFD700';
        ctx.font = ft.levelUp ? 'bold 20px "Press Start 2P", monospace' : '16px "Press Start 2P", monospace';
        ctx.fillText(ft.text, ft.x + player.w / 2, ft.y);
    }
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function startGame() {
    const nameInput = document.getElementById('player-name');
    const countryInput = document.getElementById('player-country');
    playerName = nameInput && nameInput.value.trim() ? nameInput.value.trim() : 'Jackpot';
    playerCountry = countryInput ? countryInput.value.split(' ')[0] : '🇯🇵';

    nameDisplay.textContent = playerName;

    menuScreen.classList.add('hidden');
    hudEl.classList.remove('hidden');
    score = 0;
    level = 1;
    floor = 1;
    speed = 1.8;
    isCheering = false;
    isPaused = false;
    scoreDisplay.textContent = '0';
    gameState = 'playing';
    player.x = 60;
    player.y = GROUND_Y - player.h;
    foods = [];
    obstacles = [];
    floatingTexts = [];
    document.getElementById('pause-btn').classList.remove('hidden');
    const music = document.getElementById('background-music');
    if (music && music.contentWindow && !isMuted) {
        music.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'setVolume', args: [30] }), '*');
        music.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
    }

    gameState = 'instructions'; 
    showInstructionModal();
}

function restartGame() {
    gameoverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    hudEl.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    gameState = 'menu';
    score = 0;
    scoreDisplay.textContent = '0';
    // nameInput.value = '';
    nameDisplay.textContent = '';

    playerName = 'Player';
    playerCountry = '🇯🇵';

    player.x = 60;
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    foods = [];
    obstacles = [];
    floatingTexts = [];
    document.getElementById('pause-btn').classList.add('hidden');
}

function endGameOver() {
    if (gameState === 'gameover') return;
    gameState = 'gameover';
    saveScore();
    const gameoverScore = document.getElementById('gameover-score');
    if (gameoverScore) gameoverScore.textContent = `${playerName} · ${playerCountry} · ${score} points`;
    gameoverScreen.classList.remove('hidden');
    hudEl.classList.add('hidden');
    document.getElementById('pause-btn').classList.add('hidden');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        keys.jump = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') keys.left = false;
    if (e.key === 'ArrowRight') keys.right = false;
    if (e.key === 'ArrowUp' || e.key === ' ') {
        keys.jump = false;
    }
});

function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e.changedTouches[0];
    const x = (touch.clientX - rect.left) / rect.width * W;
    const y = (touch.clientY - rect.top) / rect.height * H;
    return { x, y };
}

document.addEventListener('touchstart', (e) => {
    if (gameState !== 'playing') return;
    const { x, y } = getTouchPos(e);
    keys.left = x < W / 3;
    keys.right = x > (W / 3) * 2;
    keys.jump = y < H / 3;
    e.preventDefault();
});

document.addEventListener('touchmove', (e) => {
    if (gameState !== 'playing') return;
    const { x, y } = getTouchPos(e);
    keys.left = x < W / 3;
    keys.right = x > (W / 3) * 2;
    keys.jump = y < H / 3;
    e.preventDefault();
});

document.addEventListener('touchend', () => {
    keys.left = false;
    keys.right = false;
    keys.jump = false;
});

// Keypress listener (movement + modal dismissal)
document.addEventListener('keydown', (e) => {
    // If instruction modal is visible, close it on any key press
    if (gameState === 'instructions') {
        closeInstructionModal();
        return;
    }

    if (e.key === 'ArrowLeft') keys.left = true;
    if (e.key === 'ArrowRight') keys.right = true;
    if (e.key === 'ArrowUp' || e.key === ' ') {
        e.preventDefault();
        keys.jump = true;
    }
});

// Click / Touch listener for modal dismissal
const instructionModalEl = document.getElementById('instruction-modal');
if (instructionModalEl) {
    instructionModalEl.addEventListener('click', () => {
        if (gameState === 'instructions') {
            closeInstructionModal();
        }
    });
}

// --- FETCH COUNTRIES FROM API ---
async function fetchCountries() {
    const countrySelect = document.getElementById('player-country');
    if (!countrySelect) return;

    try {
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,flag,cca2');
        if (!response.ok) throw new Error('API request failed');
        
        const countries = await response.json();

        // Sort countries alphabetically by common name
        countries.sort((a, b) => a.name.common.localeCompare(b.name.common));

        // Clear "Loading countries..." and set initial placeholder
        countrySelect.innerHTML = '<option value="">Select Country...</option>';

        // Populate strictly from API data
        countries.forEach(country => {
            const option = document.createElement('option');
            const flag = country.flag || '';
            const name = country.name.common;
            option.value = `${flag} ${name}`;
            option.textContent = `${flag} ${name}`;
            countrySelect.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load countries:', error);
        countrySelect.innerHTML = '<option value="">Failed to load countries</option>';
    }
}

// Start loop
document.addEventListener('DOMContentLoaded', () => {
    fetchCountries();
    renderLeaderboard();
    gameLoop();
});