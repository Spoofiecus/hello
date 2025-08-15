// =========
// Basic Setup
// =========
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// =========
// World and Camera
// =========
const world = { width: 2000, height: 2000 };
const camera = { x: 0, y: 0 };

// =========
// Game State
// =========
let score = 0;
let animationId;
let isGameOver = false;
let isGameStarted = false;
let isGameWon = false;

// =========
// Game Objects
// =========
const player = {
    x: world.width / 2,
    y: world.height / 2,
    radius: 15,
    color: 'blue',
    speed: 4,
    health: 100,
    maxHealth: 100,
    inventory: [],
    isInvincible: false
};

const restartButton = {
    x: canvas.width / 2 - 60,
    y: canvas.height / 2 + 60,
    width: 120,
    height: 40
};

const bullets = [];
const enemyBullets = [];
const walls = [
    // Border walls
    { x: 0, y: 0, width: world.width, height: 10 },
    { x: 0, y: world.height - 10, width: world.width, height: 10 },
    { x: 0, y: 0, width: 10, height: world.height },
    { x: world.width - 10, y: 0, width: 10, height: world.height },
    // Sample inner walls
    { x: 300, y: 300, width: 400, height: 30 },
    { x: 800, y: 600, width: 30, height: 500 },
    { x: 1200, y: 200, width: 30, height: 300 },
    { x: 1000, y: 1100, width: 500, height: 30 },
];

const MASTER_LOOT_LIST = [
    { x: 400, y: 450, radius: 10, color: 'gold', name: 'Keycard' },
    { x: 1500, y: 800, radius: 8, color: '#32cd32', name: 'Health Pack' },
    { x: 900, y: 150, radius: 8, color: 'cyan', name: 'Ammo' },
];
let lootItems = [];

const MASTER_ENEMY_LIST = [
    { x: 200, y: 200, radius: 15, color: '#c82333', speed: 2, detectionRadius: 350, isActive: false, health: 100, maxHealth: 100, fireRate: 2000, shootCooldown: 0 },
    { x: 830, y: 1200, radius: 20, color: '#a01c28', speed: 1.5, detectionRadius: 400, isActive: false, health: 150, maxHealth: 150, fireRate: 2500, shootCooldown: 0 },
    { x: 1600, y: 500, radius: 15, color: '#c82333', speed: 2, detectionRadius: 300, isActive: false, health: 100, maxHealth: 100, fireRate: 2000, shootCooldown: 0 },
    { x: 1400, y: 1400, radius: 15, color: '#c82333', speed: 2, detectionRadius: 300, isActive: false, health: 100, maxHealth: 100, fireRate: 2000, shootCooldown: 0 },
    { x: 450, y: 800, radius: 15, color: '#c82333', speed: 2.2, detectionRadius: 300, isActive: false, health: 100, maxHealth: 100, fireRate: 1800, shootCooldown: 0 },
];
let enemies = [];

const extractionPoints = [
    { x: 20, y: 20, width: 80, height: 80 },
    { x: world.width - 100, y: world.height - 100, width: 80, height: 80 }
];

// =========
// Input Handling
// =========
const keys = {
    ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
};
window.addEventListener('keydown', (e) => { if (e.key in keys) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

canvas.addEventListener('mousedown', (e) => {
    if (!isGameStarted || isGameOver || isGameWon) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left + camera.x;
    const mouseY = e.clientY - rect.top + camera.y;
    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    const bulletSpeed = 8;
    const dx = Math.cos(angle) * bulletSpeed;
    const dy = Math.sin(angle) * bulletSpeed;
    bullets.push({ x: player.x, y: player.y, radius: 5, color: 'orange', dx, dy });
});

canvas.addEventListener('click', (e) => {
    if (!isGameStarted) {
        startGame();
        return;
    }
    if (isGameOver || isGameWon) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        if (mouseX >= restartButton.x && mouseX <= restartButton.x + restartButton.width &&
            mouseY >= restartButton.y && mouseY <= restartButton.y + restartButton.height) {
            restartGame();
        }
    }
});

// =========
// Collision Detection
// =========
function isCollidingCircleRect(circle, rect) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));
    const distance = Math.hypot(circle.x - closestX, circle.y - closestY);
    return distance < circle.radius;
}

// =========
// Game Logic
// =========

/**
 * Initializes or resets the game to its starting state.
 */
function startGame() {
    isGameStarted = true;
    isGameOver = false;
    isGameWon = false;
    score = 0;
    player.x = world.width / 2;
    player.y = world.height / 2;
    player.health = player.maxHealth;
    player.isInvincible = false;
    player.inventory = [];
    bullets.length = 0;
    enemyBullets.length = 0;
    // Create deep copies of the master lists for the current game session
    lootItems = JSON.parse(JSON.stringify(MASTER_LOOT_LIST));
    enemies = JSON.parse(JSON.stringify(MASTER_ENEMY_LIST));
    gameLoop();
}

/**
 * Restarts the game by calling startGame.
 */
function restartGame() {
    startGame();
}

/**
 * Updates the player's position based on keyboard input and handles wall collisions.
 * This implementation checks X and Y movement separately to allow sliding along walls.
 */
function updatePlayerPosition() {
    let dx = 0;
    let dy = 0;
    if (keys.ArrowUp) dy -= player.speed;
    if (keys.ArrowDown) dy += player.speed;
    if (keys.ArrowLeft) dx -= player.speed;
    if (keys.ArrowRight) dx += player.speed;

    // Move on X axis and check for collision
    player.x += dx;
    for (const wall of walls) {
        if (isCollidingCircleRect(player, wall)) {
            player.x -= dx; // Revert X movement
            break;
        }
    }

    // Move on Y axis and check for collision
    player.y += dy;
    for (const wall of walls) {
        if (isCollidingCircleRect(player, wall)) {
            player.y -= dy; // Revert Y movement
            break;
        }
    }
}

/**
 * Updates the camera's position to follow the player, clamping it to the world boundaries.
 */
function updateCamera() {
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
    camera.x = Math.max(0, Math.min(camera.x, world.width - canvas.width));
    camera.y = Math.max(0, Math.min(camera.y, world.height - canvas.height));
}

/**
 * Updates bullet positions and handles their collision with walls.
 */
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
        for (const wall of walls) {
            if (isCollidingCircleRect(bullet, wall)) {
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

/**
 * Updates enemy bullet positions and handles their collision with walls and the player.
 */
function updateEnemyBullets() {
    const enemyBulletDamage = 10;

    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const bullet = enemyBullets[i];
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;

        // Wall collision
        for (const wall of walls) {
            if (isCollidingCircleRect(bullet, wall)) {
                enemyBullets.splice(i, 1);
                break;
            }
        }

        // Player collision
        if (isCollidingCircleRect(bullet, player) && !player.isInvincible) {
            player.health -= enemyBulletDamage;
            player.isInvincible = true;
            enemyBullets.splice(i, 1);

            let flashInterval = setInterval(() => {
                player.color = player.color === 'blue' ? 'rgba(0,0,255,0.5)' : 'blue';
            }, 100);
            setTimeout(() => {
                player.isInvincible = false;
                player.color = 'blue';
                clearInterval(flashInterval);
            }, 2000);

            if (player.health <= 0) {
                isGameOver = true;
            }
            break;
        }
    }
}

/**
 * Checks for player collision with loot items and adds them to the inventory.
 */
function updateLoot() {
    for (let i = lootItems.length - 1; i >= 0; i--) {
        const item = lootItems[i];
        const dist = Math.hypot(player.x - item.x, player.y - item.y);
        if (dist < player.radius + item.radius) {
            player.inventory.push(item);
            lootItems.splice(i, 1);
        }
    }
}

/**
 * Updates enemy positions, handles their AI state, and checks for collisions.
 */
function updateEnemies() {
    const bulletDamage = 25;
    const enemyCollisionDamage = 20;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];

        // Activation logic
        if (!enemy.isActive) {
            const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
            if (distToPlayer < enemy.detectionRadius) {
                enemy.isActive = true;
                // Set initial cooldown when activated to stagger their first shots
                enemy.shootCooldown = Date.now() + Math.random() * enemy.fireRate;
            }
        }

        // If active, move, shoot, and check for collisions
        if (enemy.isActive) {
            // Movement
            const oldPos = { x: enemy.x, y: enemy.y };
            const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
            let newX = enemy.x + Math.cos(angle) * enemy.speed;
            let newY = enemy.y + Math.sin(angle) * enemy.speed;
            enemy.x = newX;
            for (const wall of walls) {
                if (isCollidingCircleRect(enemy, wall)) {
                    enemy.x = oldPos.x;
                    break;
                }
            }
            enemy.y = newY;
            for (const wall of walls) {
                if (isCollidingCircleRect(enemy, wall)) {
                    enemy.y = oldPos.y;
                    break;
                }
            }

            // Shooting
            if (Date.now() > enemy.shootCooldown) {
                const bulletAngle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
                const bulletSpeed = 5;
                const dx = Math.cos(bulletAngle) * bulletSpeed;
                const dy = Math.sin(bulletAngle) * bulletSpeed;
                enemyBullets.push({ x: enemy.x, y: enemy.y, radius: 6, color: '#ff6347', dx, dy });
                enemy.shootCooldown = Date.now() + enemy.fireRate;
            }
        }

        // Player Collision
        const playerDist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (playerDist < player.radius + enemy.radius && !player.isInvincible) {
            player.health -= enemyCollisionDamage;
            player.isInvincible = true;
            let flashInterval = setInterval(() => { player.color = player.color === 'blue' ? 'rgba(0,0,255,0.5)' : 'blue'; }, 100);
            setTimeout(() => {
                player.isInvincible = false;
                player.color = 'blue';
                clearInterval(flashInterval);
            }, 2000);
            if (player.health <= 0) {
                isGameOver = true;
                return;
            }
        }

        // Bullet Collision
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            const bulletDist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (bulletDist < bullet.radius + enemy.radius) {
                enemy.health -= bulletDamage;
                bullets.splice(j, 1);
                if (enemy.health <= 0) {
                    enemies.splice(i, 1);
                    score += 100;
                }
                break;
            }
        }
    }
}

/**
 * Checks if the player has the required item and is in an extraction zone.
 */
function checkWinCondition() {
    const hasKeycard = player.inventory.some(item => item.name === 'Keycard');
    if (!hasKeycard) return;

    for (const point of extractionPoints) {
        if (isCollidingCircleRect(player, point)) {
            isGameWon = true;
            break;
        }
    }
}

// =========
// Drawing
// =========

/**
 * Draws a health bar at a specific position.
 */
function drawHealthBar(x, y, width, height, currentHealth, maxHealth) {
    // Clamp health to not be negative
    const health = Math.max(0, currentHealth);
    const healthPercentage = health / maxHealth;

    // Draw the background (empty part of the bar)
    ctx.fillStyle = '#333'; // Dark gray
    ctx.fillRect(x, y, width, height);

    // Choose color based on health percentage
    if (healthPercentage > 0.6) {
        ctx.fillStyle = '#28a745'; // Green
    } else if (healthPercentage > 0.3) {
        ctx.fillStyle = '#ffc107'; // Yellow
    } else {
        ctx.fillStyle = '#dc3545'; // Red
    }

    // Draw the current health
    const healthWidth = width * healthPercentage;
    ctx.fillRect(x, y, healthWidth, height);

    // Optional: Draw a border for the health bar
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);
}

/**
 * Main drawing function for the game. Clears the canvas and draws all objects.
 */
function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#d3d3d3';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Use camera to translate the world
    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Draw world elements
    const hasKeycard = player.inventory.some(item => item.name === 'Keycard');
    extractionPoints.forEach(p => {
        ctx.fillStyle = hasKeycard ? 'rgba(0, 255, 0, 0.4)' : 'rgba(255, 0, 0, 0.4)';
        ctx.fillRect(p.x, p.y, p.width, p.height);
        ctx.fillStyle = 'white';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('EXTRACT', p.x + p.width / 2, p.y + p.height / 2 + 6);
    });

    walls.forEach(w => { ctx.fillStyle = '#a9a9a9'; ctx.fillRect(w.x, w.y, w.width, w.height); });
    lootItems.forEach(item => drawCircle(item.x, item.y, item.radius, item.color));

    enemies.forEach(e => {
        drawCircle(e.x, e.y, e.radius, e.color);
        // Draw health bar above enemy if they've taken damage
        if (e.health < e.maxHealth) {
            drawHealthBar(e.x - e.radius, e.y - e.radius - 15, e.radius * 2, 5, e.health, e.maxHealth);
        }
    });

    bullets.forEach(b => drawCircle(b.x, b.y, b.radius, b.color));
    enemyBullets.forEach(b => drawCircle(b.x, b.y, b.radius, b.color));
    drawCircle(player.x, player.y, player.radius, player.color);

    ctx.restore();

    // Draw UI elements (not affected by camera)
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.textAlign = 'start';
    ctx.fillText('Score: ' + score, 10, 30);
    const inventoryText = 'Inventory: ' + (player.inventory.length > 0 ? player.inventory.map(item => item.name).join(', ') : 'Empty');
    ctx.fillText(inventoryText, 10, 60);

    if (!hasKeycard) {
        ctx.fillText('Objective: Find the Keycard!', 10, 120);
    } else {
        ctx.fillStyle = 'green';
        ctx.fillText('Objective: Get to an extraction point!', 10, 120);
    }

    // Draw Player Health Bar
    ctx.fillStyle = 'black';
    ctx.fillText('Health:', 10, 90);
    drawHealthBar(90, 75, 200, 20, player.health, player.maxHealth);
}

function drawCircle(x, y, radius, color) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, false);
    ctx.fillStyle = color;
    ctx.fill();
}

function drawStartScreen() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Delta Force: 2D Extraction', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '20px Arial';
    ctx.fillText('Find the Keycard and extract!', canvas.width / 2, canvas.height/2 + 20);
    ctx.fillText('Click to Start', canvas.width / 2, canvas.height / 2 + 50);
    ctx.textAlign = 'start';
}

function drawGameOverScreen() {
    cancelAnimationFrame(animationId);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '25px Arial';
    ctx.fillText('Score: ' + score, canvas.width / 2, canvas.height / 2 + 10);
    ctx.fillStyle = 'limegreen';
    ctx.fillRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height);
    ctx.fillStyle = 'white';
    ctx.font = '25px Arial';
    ctx.fillText('Restart', canvas.width / 2, restartButton.y + 28);
    ctx.textAlign = 'start';
}

function drawWinScreen() {
    cancelAnimationFrame(animationId);
    ctx.fillStyle = 'rgba(20, 140, 20, 0.8)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '50px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Extraction Successful!', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '20px Arial';
    ctx.fillText('You found the Keycard and made it out alive.', canvas.width / 2, canvas.height / 2);
    ctx.font = '25px Arial';
    ctx.fillText('Final Score: ' + score, canvas.width / 2, canvas.height / 2 + 30);
    ctx.fillStyle = 'limegreen';
    ctx.fillRect(restartButton.x, restartButton.y, restartButton.width, restartButton.height);
    ctx.fillStyle = 'white';
    ctx.font = '25px Arial';
    ctx.fillText('Play Again', canvas.width / 2, restartButton.y + 28);
    ctx.textAlign = 'start';
}

// =========
// Main Game Loop
// =========
function gameLoop() {
    // State machine for the game
    if (!isGameStarted) {
        drawStartScreen();
        return;
    }
    if (isGameWon) {
        drawWinScreen();
        return;
    }
    if (isGameOver) {
        drawGameOverScreen();
        return;
    }

    // If the game is running, update and draw everything
    animationId = requestAnimationFrame(gameLoop);
    updatePlayerPosition();
    updateCamera();
    updateBullets();
    updateEnemyBullets();
    updateLoot();
    updateEnemies();
    checkWinCondition();
    drawGame();
}

// --- Initial Call ---
gameLoop();
