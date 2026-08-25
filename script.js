// --- AUDIO INITIALIZATION ---
let audioCtx;
let isMuted = false;
let instructionTimer = null;
let isPaused = false;
let leaderboard = JSON.parse(localStorage.getItem('jackpot-leaderboard') || 'null') || [
    { name: 'Liyana', country: 'MY', score: 4 }
];
let BOUND_LEFT = 0;
let BOUND_RIGHT = 0;
const PLAYER_BOUNDARY_MARGIN = 0.08; // 8% margin from each side – adjust to match your "red area"
const SUPABASE_URL = 'https://xvujayoqsumbxlkdgsqo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_UPWp7LPNk3FqVYNlWR9T1Q_mre_Dq8A';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);


// Show Instructions in Pause Mode
function showInstructionModal() {
    const modal = document.getElementById('instruction-modal');
    const modalCat = document.getElementById('modal-cat-preview');
    
    if (modal) {
        if (modalCat) {
            modalCat.src = 'images/ready.webp';
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

        initAudio();
    }
}

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const music = document.getElementById('background-music');
    if (music && music.paused) {
        music.volume = 0.01;
        music.muted = isMuted;
        music.play().catch(err => console.log('Autoplay prevented. Waiting for user interaction:', err));
    }
}

function getPlayerStartX() {
    // return Math.max(16, Math.min(W * 0.025, W - player.w));
    return BOUND_LEFT + 20;
}

// Global user interaction listeners to bypass autoplay restrictions on page load
window.addEventListener('click', initAudio, { once: true });
window.addEventListener('keydown', initAudio, { once: true });
window.addEventListener('touchstart', initAudio, { once: true });

// Toggle Mute Function
function toggleMute() {
    isMuted = !isMuted;
    const muteIcon = document.getElementById('mute-icon');
    if (muteIcon) {
        muteIcon.src = isMuted ? 'images/mute.svg' : 'images/unmute.svg';
    }
    const music = document.getElementById('background-music');
    if (music) {
        music.muted = isMuted;
    }
}

function renderLeaderboard() {
    leaderboard.sort((a, b) => b.score - a.score);
    const list = document.getElementById('leaderboard-list');
    if (list) {
        const highestScore = leaderboard[0];
        if (highestScore) {
            list.innerHTML = `
                <div class="flex items-center justify-between w-full">
                    <span>🏆</span>
                    <span class="truncate px-2">${highestScore.country} ${highestScore.name} ${highestScore.score}</span>
                    <span>🏆</span>
                </div>
            `;
        } else {
            list.innerHTML = '';
        }
    }
}

function saveScore() {
    if (!playerName || score <= 0) return;

    // Check existing local entry
    const existingIndex = leaderboard.findIndex(item => item.name === playerName);

    if (existingIndex !== -1) {
        // Only update local array if score is higher
        if (score > leaderboard[existingIndex].score) {
            leaderboard[existingIndex].score = score;
            leaderboard[existingIndex].country = playerCountry;
        }
    } else {
        leaderboard.push({ name: playerName, country: playerCountry, score });
    }

    localStorage.setItem('jackpot-leaderboard', JSON.stringify(leaderboard));
    renderLeaderboard();
    saveScoreToSupabase({ name: playerName, country: playerCountry, score });
}

async function loadLeaderboardFromSupabase() {
    const { data, error } = await supabaseClient
        .from('leaderboard')
        .select('name, country, score')
        .order('score', { ascending: false })
        .limit(100);

    if (error) {
        console.warn('Supabase leaderboard unavailable; using local scores.', error.message);
        return;
    }

    leaderboard = (data || []).map(item => ({
        name: item.name,
        country: item.country,
        score: item.score
    }));

    localStorage.setItem('jackpot-leaderboard', JSON.stringify(leaderboard));
    renderLeaderboard();
}

async function saveScoreToSupabase(scoreEntry) {
    const sanitizedName = (scoreEntry.name || 'Player').trim().slice(0, 14) || 'Player';
    if (scoreEntry.score <= 0) return;

    // 1. Fetch current global high score
    const { data, error } = await supabaseClient
        .from('leaderboard')
        .select('score')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        console.warn('Could not fetch global score:', error.message);
        return;
    }

    const currentBest = data?.score || 0;
    if (scoreEntry.score <= currentBest) {
        console.log('Not a new global high score.');
        return;
    }

    // 2. Update the single row
    const { error: updateError } = await supabaseClient
        .from('leaderboard')
        .update({
            name: sanitizedName,
            country: scoreEntry.country || 'Unknown',
            score: scoreEntry.score,
            updated_at: new Date().toISOString()
        })
        .eq('id', 1);

    if (updateError) {
        console.error('Failed to update global high score:', updateError.message);
    } else {
        console.log('New global high score!');
        loadLeaderboardFromSupabase(); // refresh local display
    }
}

function togglePause() {
    if (gameState !== 'playing' && gameState !== 'paused') return;
    isPaused = !isPaused;
    gameState = isPaused ? 'paused' : 'playing';
    const pauseIcon = document.getElementById('pause-icon');
    if (pauseIcon) {
        pauseIcon.src = isPaused ? 'images/play.PNG' : 'images/pause.PNG';
    }

    if (isPaused) {
        catImg = catPauseImg;
    } else {
        updateCatImage(); // restore based on current movement
    }

    const music = document.getElementById('background-music');
    if (music) {
        if (isPaused) {
            music.pause();
        } else if (!isMuted) {
            music.play().catch(err => console.log('Audio playback blocked:', err));
        }
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
const PLAYER_WIDTH = 64;
const PLAYER_HEIGHT = 64;

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
const jackpotImg = new Image();
jackpotImg.src = 'images/ready.webp';
const catJumpImg = new Image();
catJumpImg.src = 'images/jump.webp';
const catLeftImg = new Image();
catLeftImg.src = 'images/left.webp';
const catRightImg = new Image();
catRightImg.src = 'images/right.webp';
const catPauseImg = new Image();
catPauseImg.src = 'images/pause.webp';
let catImg = jackpotImg;

const accessoriesImages = [];
for (let i = 1; i <= 7; i++) {
    const img = new Image();
    img.src = `images/Accessories-${i}.webp`;
    accessoriesImages.push(img);
}

//using images for background
// const backgroundImg = new Image();
// backgroundImg.src = 'images/background.webm';

// to hold background frames
const bgFrames = [];
const FRAME_COUNT = 5;
let currentBgFrame = 0;
let bgFrameTimer = 0;
const BG_FRAME_INTERVAL = 6; // frames per image – adjust for speed

// Load all five scene images
for (let i = 1; i <= 5; i++) {
    const img = new Image();
    img.src = `images/scene${i}.PNG`; // adjust extension if needed
    bgFrames.push(img);
}

const secondFloorImg = new Image();
secondFloorImg.src = 'images/2nd floor.png';
const accessoryImages = [
    ...accessoriesImages,
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
obstacleImages[2].src = 'images/awan1.webp';
obstacleImages[3].src = 'images/awan2.webp';

function isVisualObstacle(img) {
    return img === obstacleImages[2] || img === obstacleImages[3];
}

function updateCatImage() {
    // If game is paused, show pause image
    if (gameState === 'paused') {
        catImg = catPauseImg;
        return;
    }

    // If player is in the air, show jump image
    if (!player.onGround) {
        catImg = catJumpImg;
        return;
    }

    // On ground: choose direction or idle
    if (keys.left) {
        catImg = catLeftImg;
    } else if (keys.right) {
        catImg = catRightImg;
    } else {
        catImg = jackpotImg;
    }
}

// --- GAME OBJECTS ---
const player = {
    x: 20,
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
const secondFloor = {
    x: 0,
    y: 0,
    w: 0,
    h: 10,
    previousX: 0
};

// --- RESIZE LOGIC (Placed after variable declarations) ---
function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;

    // Calculate left/right boundaries
    BOUND_LEFT = W * PLAYER_BOUNDARY_MARGIN;
    BOUND_RIGHT = W - player.w - W * PLAYER_BOUNDARY_MARGIN;

    // Safety fallback if margin is too large
    if (BOUND_LEFT >= BOUND_RIGHT) {
        BOUND_LEFT = 20;
        BOUND_RIGHT = W - player.w - 20;
    }

    // Clamp player within new bounds after resize
    player.x = Math.max(BOUND_LEFT, Math.min(BOUND_RIGHT, player.x));

    const isMobile = window.innerWidth <= 640;
    GROUND_Y = isMobile ? H - 80 : H - 100;

    canvas.width = W;
    canvas.height = H;

    secondFloor.y = GROUND_Y - Math.min(132, H * 0.28);
    secondFloor.w = W * 0.20;
    if (!secondFloor.x || secondFloor.x > W) {
        secondFloor.x = W * 0.275;
    }

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

    // Update background frame every BG_FRAME_INTERVAL frames
    bgFrameTimer++;
    if (bgFrameTimer >= BG_FRAME_INTERVAL) {
        bgFrameTimer = 0;
        currentBgFrame = (currentBgFrame + 1) % FRAME_COUNT;
    }

    playWalkSFX();

    secondFloor.previousX = secondFloor.x;
    secondFloor.x -= speed;
    if (secondFloor.x + secondFloor.w < 0) {
        secondFloor.x = W + 40;
    }
    const secondFloorDelta = secondFloor.x - secondFloor.previousX;

    if (keys.left) player.x -= 2.6;
    if (keys.right) player.x += 2.6;
    player.x = Math.max(BOUND_LEFT, Math.min(BOUND_RIGHT, player.x));

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
        catImg = catJumpImg; 
        playJumpSFX();
    }

    const previousBottom = player.y + player.h;
    player.vy += player.gravity;
    player.y += player.vy;

    const upperFloorY = secondFloor.y;
    const onSecondFloor = player.x + player.w > secondFloor.x && player.x < secondFloor.x + secondFloor.w;
    if (player.vy >= 0 && previousBottom <= upperFloorY && player.y + player.h >= upperFloorY && onSecondFloor) {
        player.y = upperFloorY - player.h;
        player.vy = 0;
        player.onGround = true;
        floor = 2;
        player.x += secondFloorDelta;
        player.x = Math.max(BOUND_LEFT, Math.min(BOUND_RIGHT, player.x));
        if (catImg === catJumpImg) catImg = jackpotImg;
    }

    if (player.y >= GROUND_Y - player.h) {
        player.y = GROUND_Y - player.h;
        player.vy = 0;
        player.onGround = true;
        floor = 1;
        // if (catImg === catJumpImg) catImg = jackpotImg;
    }

    const newLevel = Math.floor(score / 100) + 1;
    if (newLevel > level) {
        level = newLevel;
        speed = 1.8 + (level - 1) * 0.45;
        playWinSFX();
        floatingTexts.push({ x: W / 2, y: H / 2, text: `LEVEL ${level}`, life: 120, maxLife: 120, levelUp: true });
    }
    if (leaderboard.length > 0 && score > leaderboard[0].score && !isCheering) {
        isCheering = true;
        player.frame = 3;
        playWinSFX();
        floatingTexts.push({ x: player.x, y: player.y - 20, text: 'NEW HIGH SCORE!', life: 110, maxLife: 110, levelUp: true });
    }

    if (frameCount % 70 === 0) {
        if (Math.random() < 0.6) {
            const randomFood = accessoriesImages[Math.floor(Math.random() * accessoriesImages.length)];
            const foodW = 32;
            const foodH = 48;
            const useUpperFloor = Math.random() < Math.min(0.2 + level * 0.08, 0.65);
            const yPos = useUpperFloor ? upperFloorY - foodH - 2 : GROUND_Y - foodH - Math.random() * Math.min(80 + level * 10, 130);
            const proposedFood = {
                x: useUpperFloor ? secondFloor.x + Math.random() * Math.max(0, secondFloor.w - foodW) : W + 20,
                y: yPos,
                w: foodW,
                h: foodH,
                img: randomFood,
                floor: useUpperFloor ? 2 : 1,
                onSecondFloor: useUpperFloor
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
            //awan size
            const obstacleH = isVisualObstacle(obstacleImg) ? 100 : 70;
            const obstacleY = isVisualObstacle(obstacleImg) ? 70 + Math.random() * 120 : GROUND_Y - obstacleH;

            obstacles.push({
                x: W + 20,
                y: obstacleY,
                //awan size
                w: isVisualObstacle(obstacleImg) ? 140 : 60,
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
        if (foods[i].onSecondFloor) {
            foods[i].x += secondFloorDelta;
            foods[i].y = secondFloor.y - foods[i].h - 2;
        } else {
            foods[i].x -= speed;
        }
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
    updateCatImage();
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    // image background
    // if (backgroundImg.complete && backgroundImg.naturalWidth > 0) {
    //     const coverScale = Math.max(W / backgroundImg.naturalWidth, H / backgroundImg.naturalHeight);
    //     const backgroundWidth = backgroundImg.naturalWidth * coverScale;
    //     const backgroundHeight = backgroundImg.naturalHeight * coverScale;
    //     ctx.drawImage(
    //         backgroundImg,
    //         (W - backgroundWidth) / 2,
    //         (H - backgroundHeight) / 2,
    //         backgroundWidth,
    //         backgroundHeight
    //     );
    // } else {
    //     ctx.fillStyle = '#87CEEB';
    //     ctx.fillRect(0, 0, W, H);
    // }

    // Draw video background (if ready)
    const currentFrame = bgFrames[currentBgFrame];
    if (currentFrame && currentFrame.complete && currentFrame.naturalWidth > 0) {
        const coverScale = Math.max(W / currentFrame.naturalWidth, H / currentFrame.naturalHeight);
        const frameWidth = currentFrame.naturalWidth * coverScale;
        const frameHeight = currentFrame.naturalHeight * coverScale;
        ctx.drawImage(
            currentFrame,
            (W - frameWidth) / 2,
            (H - frameHeight) / 2,
            frameWidth,
            frameHeight
        );
    }else {
        // Fallback solid color
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, W, H);
    }

    if (secondFloorImg.complete && secondFloorImg.naturalWidth > 0) {
        const platformHeight = secondFloor.w * secondFloorImg.naturalHeight / secondFloorImg.naturalWidth;
        ctx.drawImage(secondFloorImg, secondFloor.x, secondFloor.y, secondFloor.w, platformHeight);
    } else {
        ctx.fillStyle = '#6b4e71';
        ctx.fillRect(secondFloor.x, secondFloor.y, secondFloor.w, secondFloor.h);
    }

    for (let obs of obstacles) {
        if (obs.img && obs.img.complete && obs.img.naturalWidth > 0) {
            ctx.drawImage(obs.img, obs.x, obs.y, obs.w, obs.h);
        } else {
            ctx.fillStyle = '#2d6a2e';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.fillRect(obs.x - 8, obs.y + 10, 8, 6);
            ctx.fillRect(obs.x + obs.w, obs.y + 15, 8, 6);
        }
    }

    for (let f of foods) {
        if (f.img.complete && f.img.naturalWidth > 0) {
            ctx.drawImage(f.img, f.x, f.y, f.w, f.h);
        } else {
            ctx.fillStyle = 'yellow';
            ctx.fillRect(f.x, f.y, f.w, f.h);
        }
    }

    if (catImg.complete && catImg.naturalWidth > 0) {
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

    // Set initial mute icon (unmuted)
    const muteIcon = document.getElementById('mute-icon');
    if (muteIcon) muteIcon.src = 'images/unmute.svg';
    // Pause icon initially shows pause (since game is not paused)
    const pauseIcon = document.getElementById('pause-icon');
    if (pauseIcon) pauseIcon.src = 'images/pause.PNG';

    score = 0;
    level = 1;
    floor = 1;
    speed = 1.8;
    isCheering = false;
    isPaused = false;
    scoreDisplay.textContent = '0';
    renderLeaderboard();
    initAudio();
    gameState = 'playing';
    player.x = getPlayerStartX();
    player.y = GROUND_Y - player.h;
    foods = [];
    obstacles = [];
    floatingTexts = [];
    document.getElementById('pause-btn').classList.remove('hidden');
    const music = document.getElementById('background-music');
        if (music) {
            music.volume = 0.3; // 30% volume
            music.muted = isMuted;
            music.play().catch(err => console.log('Audio playback blocked:', err));
        }

    gameState = 'instructions'; 
    showInstructionModal();
}

function restartGame() {
    catImg = jackpotImg;
    gameoverScreen.classList.add('hidden');
    winScreen.classList.add('hidden');
    hudEl.classList.add('hidden');
    menuScreen.classList.remove('hidden');
    gameState = 'menu';
    score = 0;
    scoreDisplay.textContent = '0';
    nameDisplay.textContent = '';

    playerName = 'Player';
    playerCountry = '🇯🇵';

    player.x = getPlayerStartX();
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
    const countryButton = document.getElementById('country-dropdown-button');
    const countryOptions = document.getElementById('country-dropdown-options');
    const countrySearch = document.getElementById('country-search');
    const countryOptionList = document.getElementById('country-option-list');
    if (!countrySelect) return;

    const renderCountryOptions = (searchTerm = '') => {
        if (!countryButton || !countryOptions || !countryOptionList) return;
        countryOptionList.innerHTML = '';
        const normalizedSearch = searchTerm.trim().toLowerCase();
        Array.from(countrySelect.options).forEach((option) => {
            if (!option.value) return;
            if (normalizedSearch && !option.textContent.toLowerCase().includes(normalizedSearch)) return;
            const countryOption = document.createElement('button');
            countryOption.type = 'button';
            countryOption.className = 'country-dropdown-option';
            countryOption.setAttribute('role', 'option');
            countryOption.textContent = option.textContent;
            countryOption.addEventListener('click', () => {
                countrySelect.value = option.value;
                countryButton.textContent = option.textContent;
                countryOptions.classList.add('hidden');
                countryButton.setAttribute('aria-expanded', 'false');
            });
            countryOptionList.appendChild(countryOption);
        });
        if (!countryOptionList.children.length) {
            const noResults = document.createElement('div');
            noResults.className = 'country-no-results';
            noResults.textContent = 'No country found';
            countryOptionList.appendChild(noResults);
        }
        countryButton.textContent = countrySelect.options[countrySelect.selectedIndex]?.textContent || 'Select Country...';
    };

    if (countryButton && countryOptions) {
        countryButton.addEventListener('click', () => {
            const isOpen = !countryOptions.classList.contains('hidden');
            countryOptions.classList.toggle('hidden', isOpen);
            countryButton.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen && countrySearch) countrySearch.focus();
        });
    }

    if (countrySearch) {
        countrySearch.addEventListener('input', () => renderCountryOptions(countrySearch.value));
    }

    const parseAndRender = (data) => {
        // Filter out specific entries if needed
        const filtered = data.filter(c => c.cca3 !== 'ISR');
        filtered.sort((a, b) => a.name.common.localeCompare(b.name.common));

        countrySelect.innerHTML = '<option value="">Select Country...</option>';
        filtered.forEach(country => {
            const option = document.createElement('option');
            const flag = country.flag || country.cca2 || '';
            const name = country.name.common;
            option.value = `${flag} ${name}`;
            option.textContent = `${flag} ${name}`;
            countrySelect.appendChild(option);
        });
        renderCountryOptions();
    };

    try {
        // Try Primary API
        const response = await fetch('https://restcountries.com/v3.1/all?fields=name,flag,cca2,cca3');
        if (!response.ok) throw new Error('Primary API failed');
        const data = await response.json();
        parseAndRender(data);
    } catch (err) {
        console.warn('Primary API blocked or failed, trying CDN fallback...');
        try {
            // Try Secondary Backup CDN
            const backupRes = await fetch('https://raw.githubusercontent.com/mledoze/countries/master/dist/countries.json');
            if (!backupRes.ok) throw new Error('CDN fallback failed');
            const backupData = await backupRes.json();
            
            // Format backup schema to match restcountries schema
            const formatted = backupData.map(c => ({
                name: { common: c.name.common },
                flag: c.flag,
                cca2: c.cca2,
                cca3: c.cca3
            }));
            parseAndRender(formatted);
        } catch (backupErr) {
            console.error('All remote sources failed. Populating default list.', backupErr);
            // Local offline safety net
            countrySelect.innerHTML = `
                <option value="">Select Country...</option>
                <option value="🇦🇺 Australia">🇦🇺 Australia</option>
                <option value="🇧🇳 Brunei">🇧🇳 Brunei</option>
                <option value="🇮🇩 Indonesia">🇮🇩 Indonesia</option>
                <option value="🇯🇵 Japan">🇯🇵 Japan</option>
                <option value="🇲🇾 Malaysia">🇲🇾 Malaysia</option>
                <option value="🇸🇬 Singapore">🇸🇬 Singapore</option>
                <option value="🇹🇭 Thailand">🇹🇭 Thailand</option>
                <option value="🇬🇧 United Kingdom">🇬🇧 United Kingdom</option>
                <option value="🇺🇸 United States">🇺🇸 United States</option>
                <option value="🇻🇳 Vietnam">🇻🇳 Vietnam</option>            `;
            renderCountryOptions();
        }
    }
}

// Start loop
document.addEventListener('DOMContentLoaded', () => {
    fetchCountries();
    renderLeaderboard();
    loadLeaderboardFromSupabase();
    gameLoop();
});