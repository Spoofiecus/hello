const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = 800;
canvas.height = 600;

// --- Game State ---
let score = 0;
let animationId;
let isGameOver = false;
let isGameStarted = false;
let enemySpawnInterval = 2000; // Initial spawn interval in ms

// --- Game Objects ---
const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 15,
    color: 'blue',
    speed: 5
};

const restartButton = {
    x: canvas.width / 2 - 60,
    y: canvas.height / 2 + 60,
    width: 120,
    height: 40
};

const bullets = [];
const enemies = [];

// --- Input Handling ---
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
});

canvas.addEventListener('mousedown', (e) => {
    if (!isGameStarted || isGameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    const bulletSpeed = 7;
    const dx = Math.cos(angle) * bulletSpeed;
    const dy = Math.sin(angle) * bulletSpeed;

    bullets.push({ x: player.x, y: player.y, radius: 5, color: 'red', dx, dy });
});

canvas.addEventListener('click', (e) => {
    if (!isGameStarted) {
        startGame();
        return;
    }

    if (isGameOver) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        if (mouseX >= restartButton.x && mouseX <= restartButton.x + restartButton.width &&
            mouseY >= restartButton.y && mouseY <= restartButton.y + restartButton.height) {
            restartGame();
        }
    }
});


// --- Game Logic ---
function startGame() {
    isGameStarted = true;
    score = 0;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    enemies.length = 0;
    bullets.length = 0;
    enemySpawnInterval = 2000;
    isGameOver = false;
    gameLoop();
    setTimeout(spawnEnemy, enemySpawnInterval);
}

function restartGame() {
    // Essentially the same as starting the game
    startGame();
}

function updatePlayerPosition() {
    if (keys.ArrowUp && player.y - player.radius > 0) player.y -= player.speed;
    if (keys.ArrowDown && player.y + player.radius < canvas.height) player.y += player.speed;
    if (keys.ArrowLeft && player.x - player.radius > 0) player.x -= player.speed;
    if (keys.ArrowRight && player.x + player.radius < canvas.width) player.x += player.speed;
}

function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        bullet.x += bullet.dx;
        bullet.y += bullet.dy;
        if (bullet.x - bullet.radius > canvas.width || bullet.x + bullet.radius < 0 ||
            bullet.y - bullet.radius > canvas.height || bullet.y + bullet.radius < 0) {
            bullets.splice(i, 1);
        }
    }
}

function spawnEnemy() {
    if (isGameOver) return;

    const radius = Math.random() * 20 + 10;
    let x, y;

    if (Math.random() < 0.5) {
        x = Math.random() < 0.5 ? 0 - radius : canvas.width + radius;
        y = Math.random() * canvas.height;
    } else {
        x = Math.random() * canvas.width;
        y = Math.random() < 0.5 ? 0 - radius : canvas.height + radius;
    }

    const angle = Math.atan2(player.y - y, player.x - x);
    const enemySpeed = 2.5;
    const dx = Math.cos(angle) * enemySpeed;
    const dy = Math.sin(angle) * enemySpeed;

    enemies.push({ x, y, radius, color: 'green', dx, dy });

    if (enemySpawnInterval > 600) {
        enemySpawnInterval -= 25;
    }
    setTimeout(spawnEnemy, enemySpawnInterval);
}

function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.x += enemy.dx;
        enemy.y += enemy.dy;

        // Player-enemy collision
        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        if (dist - enemy.radius - player.radius < 1) {
            isGameOver = true;
            return;
        }

        // Bullet-enemy collision
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
            if (dist - enemy.radius - bullet.radius < 1) {
                enemies.splice(i, 1);
                bullets.splice(j, 1);
                score += 10;
                break;
            }
        }
    }
}

// --- Drawing ---
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
    ctx.fillText('2D Delta Operations', canvas.width / 2, canvas.height / 2 - 40);
    ctx.font = '20px Arial';
    ctx.fillText('Click to Start', canvas.width / 2, canvas.height / 2 + 10);
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

// --- Main Game Loop ---
function gameLoop() {
    if (!isGameStarted) {
        drawStartScreen();
        return;
    }

    if (isGameOver) {
        drawGameOverScreen();
        return;
    }

    animationId = requestAnimationFrame(gameLoop);

    updatePlayerPosition();
    updateBullets();
    updateEnemies();

    // Drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCircle(player.x, player.y, player.radius, player.color);
    bullets.forEach(b => drawCircle(b.x, b.y, b.radius, b.color));
    enemies.forEach(e => drawCircle(e.x, e.y, e.radius, e.color));

    // Draw Score
    ctx.fillStyle = 'black';
    ctx.font = '20px Arial';
    ctx.textAlign = 'start';
    ctx.fillText('Score: ' + score, 10, 30);
}

// --- Initial Call ---
gameLoop();
