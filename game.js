// =========
// Basic Setup
// =========
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// =========
// Asset Management
// =========
const assets = {};
const assetSources = {
    player: 'https://i.imgur.com/M12vj32.png',
    enemy: 'https://i.imgur.com/t24i6t2.png',
    bullet: 'https://i.imgur.com/lVqj3G3.png',
    enemyBullet: 'https://i.imgur.com/c1i1sJ4.png',
    wall: 'https://i.imgur.com/uG7gSjA.png',
    ground: 'https://i.imgur.com/M5S4p5B.png',
    keycard: 'https://i.imgur.com/gA4g4gH.png',
    healthPack: 'https://i.imgur.com/Sj4J1bT.png',
};
let assetsLoaded = 0;
let totalAssets = Object.keys(assetSources).length;

function assetLoader(sources, callback) {
    for (let key in sources) {
        assets[key] = new Image();
        assets[key].src = sources[key];
        assets[key].onload = () => {
            assetsLoaded++;
            if (assetsLoaded === totalAssets) {
                callback();
            }
        };
    }
}

// =========
// World and Camera
// =========
const world = { width: 2000, height: 2000 };
const camera = { x: 0, y: 0 };
const mouse = { x: 0, y: 0 };

// =========
// Game State
// =========
let score = 0;
let animationId;
let isGameOver = false;
let isGameStarted = false;
let isGameWon = false;
let isGameInitialized = false;

// =========
// Game Objects
// =========
const player = {
    x: world.width / 2, y: world.height / 2,
    radius: 18, width: 40, height: 40, angle: 0,
    speed: 4, health: 100, maxHealth: 100,
    inventory: [], isInvincible: false
};

const restartButton = { x: canvas.width / 2 - 60, y: canvas.height / 2 + 60, width: 120, height: 40 };
const bullets = [];
const enemyBullets = [];
const walls = [
    { x: 0, y: 0, width: world.width, height: 20 }, { x: 0, y: world.height - 20, width: world.width, height: 20 },
    { x: 0, y: 0, width: 20, height: world.height }, { x: world.width - 20, y: 0, width: 20, height: world.height },
    { x: 300, y: 300, width: 400, height: 40 }, { x: 800, y: 600, width: 40, height: 500 },
    { x: 1200, y: 200, width: 40, height: 300 }, { x: 1000, y: 1100, width: 500, height: 40 },
];
const MASTER_LOOT_LIST = [
    { x: 400, y: 450, radius: 15, width: 30, height: 30, name: 'Keycard', asset: 'keycard' },
    { x: 1500, y: 800, radius: 15, width: 30, height: 30, name: 'Health Pack', asset: 'healthPack' },
];
let lootItems = [];
const MASTER_ENEMY_LIST = [
    { x: 200, y: 200, radius: 18, width: 40, height: 40, speed: 2, detectionRadius: 350, isActive: false, health: 100, maxHealth: 100, fireRate: 2000, shootCooldown: 0, angle: 0 },
    { x: 830, y: 1200, radius: 22, width: 50, height: 50, speed: 1.5, detectionRadius: 400, isActive: false, health: 150, maxHealth: 150, fireRate: 2500, shootCooldown: 0, angle: 0 },
];
let enemies = [];
const extractionPoints = [
    { x: 20, y: 20, width: 100, height: 100 }, { x: world.width - 120, y: world.height - 120, width: 100, height: 100 }
];

// =========
// Input Handling
// =========
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
window.addEventListener('keydown', (e) => { if (e.key in keys) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });
canvas.addEventListener('mousemove', (e) => { const rect = canvas.getBoundingClientRect(); mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; });
canvas.addEventListener('mousedown', (e) => {
    if (!isGameStarted || isGameOver || isGameWon) return;
    const angle = Math.atan2(mouse.y - (player.y - camera.y), mouse.x - (player.x - camera.x));
    bullets.push({ x: player.x, y: player.y, radius: 5, width: 10, height: 10, angle, dx: Math.cos(angle) * 8, dy: Math.sin(angle) * 8 });
});
canvas.addEventListener('click', (e) => { if (!isGameInitialized) return; if (!isGameStarted) { startGame(); return; } if (isGameOver || isGameWon) { const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left; const mouseY = e.clientY - rect.top; if (mouseX >= restartButton.x && mouseX <= restartButton.x + restartButton.width && mouseY >= restartButton.y && mouseY <= restartButton.y + restartButton.height) { restartGame(); } } });

// =========
// Game Logic
// =========
function isCollidingCircleRect(circle, rect) { const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width)); const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height)); const distance = Math.hypot(circle.x - closestX, circle.y - closestY); return distance < circle.radius; }
function startGame() { isGameStarted = true; isGameOver = false; isGameWon = false; score = 0; player.x = world.width / 2; player.y = world.height / 2; player.health = player.maxHealth; player.isInvincible = false; player.inventory = []; bullets.length = 0; enemyBullets.length = 0; lootItems = JSON.parse(JSON.stringify(MASTER_LOOT_LIST)); enemies = JSON.parse(JSON.stringify(MASTER_ENEMY_LIST)); if (!animationId) gameLoop(); }
function restartGame() { startGame(); }
function updatePlayer() {
    player.angle = Math.atan2(mouse.y - (player.y - camera.y), mouse.x - (player.x - camera.x));
    let dx = 0, dy = 0;
    if (keys.ArrowUp) dy -= player.speed; if (keys.ArrowDown) dy += player.speed;
    if (keys.ArrowLeft) dx -= player.speed; if (keys.ArrowRight) dx += player.speed;
    player.x += dx; walls.forEach(wall => { if(isCollidingCircleRect(player, wall)) player.x -= dx; });
    player.y += dy; walls.forEach(wall => { if(isCollidingCircleRect(player, wall)) player.y -= dy; });
}
function updateCamera() { camera.x = player.x - canvas.width / 2; camera.y = player.y - canvas.height / 2; camera.x = Math.max(0, Math.min(camera.x, world.width - canvas.width)); camera.y = Math.max(0, Math.min(camera.y, world.height - canvas.height)); }
function updateBullets(arr) {
    for (let i = arr.length - 1; i >= 0; i--) {
        const b = arr[i]; b.x += b.dx; b.y += b.dy;
        if (walls.some(w => isCollidingCircleRect(b, w))) arr.splice(i, 1);
    }
}
function updateLoot() { for (let i = lootItems.length - 1; i >= 0; i--) { if (Math.hypot(player.x - lootItems[i].x, player.y - lootItems[i].y) < player.radius + lootItems[i].radius) { player.inventory.push(lootItems.splice(i, 1)[0]); } } }
function updateEnemies() {
    const bulletDamage = 25, enemyBulletDamage = 10, enemyCollisionDamage = 20;
    enemies.forEach(e => {
        if (!e.isActive && Math.hypot(player.x - e.x, player.y - e.y) < e.detectionRadius) { e.isActive = true; e.shootCooldown = Date.now() + Math.random() * e.fireRate; }
        if (e.isActive) {
            e.angle = Math.atan2(player.y - e.y, player.x - e.x);
            let dx = Math.cos(e.angle) * e.speed, dy = Math.sin(e.angle) * e.speed;
            e.x += dx; walls.forEach(w => { if(isCollidingCircleRect(e,w)) e.x -= dx; });
            e.y += dy; walls.forEach(w => { if(isCollidingCircleRect(e,w)) e.y -= dy; });
            if (Date.now() > e.shootCooldown) {
                const angle = e.angle;
                enemyBullets.push({ x: e.x, y: e.y, radius: 6, width: 12, height: 12, angle, dx: Math.cos(angle) * 5, dy: Math.sin(angle) * 5 });
                e.shootCooldown = Date.now() + e.fireRate;
            }
        }
    });
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.radius && !player.isInvincible) {
            player.health -= enemyCollisionDamage; player.isInvincible = true;
            let flash = setInterval(() => { player.invincibleFlash = !player.invincibleFlash; }, 100);
            setTimeout(() => { player.isInvincible = false; clearInterval(flash); player.invincibleFlash = false; }, 2000);
        }
        for (let j = bullets.length - 1; j >= 0; j--) {
            if (Math.hypot(bullets[j].x - e.x, bullets[j].y - e.y) < bullets[j].radius + e.radius) {
                e.health -= bulletDamage; bullets.splice(j, 1);
                if (e.health <= 0) { enemies.splice(i, 1); score += 100; }
                break;
            }
        }
    }
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (Math.hypot(player.x - b.x, player.y - b.y) < player.radius + b.radius && !player.isInvincible) {
            player.health -= enemyBulletDamage; enemyBullets.splice(i, 1); player.isInvincible = true;
            let flash = setInterval(() => { player.invincibleFlash = !player.invincibleFlash; }, 100);
            setTimeout(() => { player.isInvincible = false; clearInterval(flash); player.invincibleFlash = false; }, 2000);
            break;
        }
    }
    if (player.health <= 0) isGameOver = true;
}
function checkWinCondition() { if (player.inventory.some(i => i.name === 'Keycard') && extractionPoints.some(p => isCollidingCircleRect(player, p))) isGameWon = true; }

// =========
// Drawing
// =========
function drawSprite(sprite, x, y, width, height, angle = 0) { ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.drawImage(sprite, -width / 2, -height / 2, width, height); ctx.restore(); }
function drawHealthBar(x, y, w, h, current, max) { const p = Math.max(0, current) / max; ctx.fillStyle = '#333'; ctx.fillRect(x, y, w, h); ctx.fillStyle = p > 0.6 ? '#28a745' : p > 0.3 ? '#ffc107' : '#dc3545'; ctx.fillRect(x, y, w * p, h); ctx.strokeStyle = '#000'; ctx.strokeRect(x, y, w, h); }
function drawGame() {
    ctx.fillStyle = assets.groundPattern; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(-camera.x, -camera.y);
    walls.forEach(w => { ctx.fillStyle = assets.wallPattern; ctx.fillRect(w.x, w.y, w.width, w.height); });
    const hasKeycard = player.inventory.some(i => i.name === 'Keycard');
    extractionPoints.forEach(p => { ctx.fillStyle = hasKeycard ? 'rgba(0,255,0,0.4)' : 'rgba(255,0,0,0.4)'; ctx.fillRect(p.x, p.y, p.width, p.height); ctx.fillStyle = 'white'; ctx.font = '18px Arial'; ctx.textAlign = 'center'; ctx.fillText('EXTRACT', p.x + p.width/2, p.y + p.height/2 + 6); });
    lootItems.forEach(item => drawSprite(assets[item.asset], item.x, item.y, item.width, item.height));
    enemies.forEach(e => { drawSprite(assets.enemy, e.x, e.y, e.width, e.height, e.angle); if (e.health < e.maxHealth) drawHealthBar(e.x - e.radius, e.y - e.radius - 15, e.radius * 2, 5, e.health, e.maxHealth); });
    bullets.forEach(b => drawSprite(assets.bullet, b.x, b.y, b.width, b.height, b.angle));
    enemyBullets.forEach(b => drawSprite(assets.enemyBullet, b.x, b.y, b.width, b.height, b.angle));
    if (!player.invincibleFlash) drawSprite(assets.player, player.x, player.y, player.width, player.height, player.angle);
    ctx.restore();
    ctx.fillStyle = 'black'; ctx.font = '20px Arial'; ctx.textAlign = 'start'; ctx.fillText('Score: ' + score, 10, 30);
    ctx.fillText('Inventory: ' + (player.inventory.length > 0 ? player.inventory.map(i => i.name).join(', ') : 'Empty'), 10, 60);
    ctx.fillText('Health:', 10, 90); drawHealthBar(90, 75, 200, 20, player.health, player.maxHealth);
    if (!hasKeycard) { ctx.fillText('Objective: Find the Keycard!', 10, 120); } else { ctx.fillStyle = 'green'; ctx.fillText('Objective: Get to an extraction point!', 10, 120); }
}
function drawCircle(x, y, radius, color) { ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2, false); ctx.fillStyle = color; ctx.fill(); }
function drawStartScreen() { ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = 'white'; ctx.font = '40px Arial'; ctx.textAlign = 'center'; ctx.fillText('Delta Force: 2D Extraction', canvas.width/2, canvas.height/2 - 40); ctx.font = '20px Arial'; ctx.fillText('Find the Keycard and extract!', canvas.width/2, canvas.height/2 + 20); ctx.fillText('Click to Start', canvas.width/2, canvas.height/2 + 50); ctx.textAlign = 'start'; }
function drawGameOverScreen() { cancelAnimationFrame(animationId); ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = 'white'; ctx.font = '50px Arial'; ctx.textAlign = 'center'; ctx.fillText('Game Over', canvas.width/2, canvas.height/2 - 40); ctx.font = '25px Arial'; ctx.fillText('Score: ' + score, canvas.width/2, canvas.height/2 + 10); ctx.fillStyle = 'limegreen'; ctx.fillRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height); ctx.fillStyle = 'white'; ctx.font = '25px Arial'; ctx.fillText('Restart', canvas.width/2, restartButton.y + 28); ctx.textAlign = 'start'; }
function drawWinScreen() { cancelAnimationFrame(animationId); ctx.fillStyle = 'rgba(20,140,20,0.8)'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle = 'white'; ctx.font = '50px Arial'; ctx.textAlign = 'center'; ctx.fillText('Extraction Successful!', canvas.width/2, canvas.height/2 - 40); ctx.font = '20px Arial'; ctx.fillText('You found the Keycard and made it out alive.', canvas.width/2, canvas.height/2); ctx.font = '25px Arial'; ctx.fillText('Final Score: ' + score, canvas.width/2, canvas.height/2 + 30); ctx.fillStyle = 'limegreen'; ctx.fillRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height); ctx.fillStyle = 'white'; ctx.font = '25px Arial'; ctx.fillText('Play Again', canvas.width/2, restartButton.y + 28); ctx.textAlign = 'start'; }

// =========
// Main Game Loop
// =========
function initGame() {
    isGameInitialized = true;
    assets.wallPattern = ctx.createPattern(assets.wall, 'repeat');
    assets.groundPattern = ctx.createPattern(assets.ground, 'repeat');
    gameLoop();
}

function gameLoop() {
    if (!isGameInitialized) {
        ctx.fillStyle = 'black'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; ctx.font = '30px Arial'; ctx.textAlign = 'center';
        ctx.fillText(`Loading Assets... ${assetsLoaded}/${totalAssets}`, canvas.width / 2, canvas.height / 2);
        requestAnimationFrame(gameLoop); return;
    }
    if (!isGameStarted) { drawStartScreen(); return; }
    if (isGameWon) { drawWinScreen(); return; }
    if (isGameOver) { drawGameOverScreen(); return; }
    animationId = requestAnimationFrame(gameLoop);
    updatePlayer();
    updateCamera();
    updateBullets(bullets);
    updateBullets(enemyBullets);
    updateLoot();
    updateEnemies();
    checkWinCondition();
    drawGame();
}

// --- Initial Call ---
assetLoader(assetSources, initGame);
