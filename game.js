// Game Constants
const CANVAS = document.getElementById('gameCanvas');
const CTX = CANVAS.getContext('2d');
const MINIMAP_CANVAS = document.getElementById('minimapCanvas');
const MINIMAP_CTX = MINIMAP_CANVAS.getContext('2d');

// Game Settings
let difficulty = 'NORMAL'; // Medium difficulty as default

// Game State
let gameState = {
    running: false,
    health: 100,
    armor: 25,
    currentWeapon: 0,
    x: 50,
    y: 50,
    angle: 0,
    enemies: [],
    projectiles: [],
    gameStarted: false,
    kills: 0,
    time: 0
};

// Weapon Data
const weapons = [
    { name: 'PISTOL', maxAmmo: 999, ammo: 999, damage: 10, fireRate: 5, icon: '🔫' },
    { name: 'SHOTGUN', maxAmmo: 50, ammo: 50, damage: 30, fireRate: 15, icon: '🔫🔫' },
    { name: 'ROCKET', maxAmmo: 20, ammo: 20, damage: 100, fireRate: 20, icon: '💣' },
    { name: 'BFG', maxAmmo: 40, ammo: 40, damage: 150, fireRate: 30, icon: '🧨' }
];

// Map Data
class Map {
    constructor() {
        this.width = 300;
        this.height = 300;
        this.tiles = this.generateMap();
    }

    generateMap() {
        const tiles = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
        
        // Walls around border
        for (let i = 0; i < this.width; i++) {
            tiles[0][i] = 1;
            tiles[this.height - 1][i] = 1;
        }
        for (let i = 0; i < this.height; i++) {
            tiles[i][0] = 1;
            tiles[i][this.width - 1] = 1;
        }

        // Internal maze-like walls
        for (let i = 50; i < 250; i += 30) {
            for (let j = 30; j < 270; j++) {
                if (Math.random() > 0.7) {
                    tiles[i][j] = 1;
                }
            }
        }

        // Add some structured walls
        for (let i = 80; i < 220; i++) {
            tiles[80][i] = 1;
            tiles[220][i] = 1;
        }

        return tiles;
    }

    isWall(x, y) {
        const tx = Math.floor(x);
        const ty = Math.floor(y);
        if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return true;
        return this.tiles[ty][tx] === 1;
    }
}

const map = new Map();

// Enemy Class
class Enemy {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.baseHealth = difficulty === 'EASY' ? 15 : difficulty === 'NORMAL' ? 25 : 40;
        this.health = this.baseHealth;
        this.speed = difficulty === 'EASY' ? 0.2 : difficulty === 'NORMAL' ? 0.35 : 0.5;
        this.visionRange = difficulty === 'EASY' ? 40 : difficulty === 'NORMAL' ? 60 : 80;
        this.attackCooldown = 0;
        this.attackDamage = difficulty === 'EASY' ? 5 : difficulty === 'NORMAL' ? 10 : 15;
    }

    update() {
        const dx = gameState.x - this.x;
        const dy = gameState.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.visionRange && distance > 2) {
            const moveX = (dx / distance) * this.speed;
            const moveY = (dy / distance) * this.speed;
            
            const newX = this.x + moveX;
            const newY = this.y + moveY;
            
            if (!map.isWall(newX, newY)) {
                this.x = newX;
                this.y = newY;
            }

            // Attack
            if (this.attackCooldown <= 0 && distance < 5) {
                gameState.health -= this.attackDamage;
                this.attackCooldown = 30;
            }
        }

        this.attackCooldown--;
    }
}

// Projectile Class
class Projectile {
    constructor(x, y, angle, damage) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = 2;
        this.damage = damage;
        this.life = 200;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;
        this.life--;

        // Check wall collision
        if (map.isWall(this.x, this.y)) {
            this.life = 0;
            return;
        }

        // Check enemy collision
        for (let enemy of gameState.enemies) {
            const dx = enemy.x - this.x;
            const dy = enemy.y - this.y;
            if (Math.sqrt(dx * dx + dy * dy) < 2) {
                enemy.health -= this.damage;
                if (enemy.health <= 0) {
                    gameState.enemies = gameState.enemies.filter(e => e !== enemy);
                    gameState.kills++;
                }
                this.life = 0;
            }
        }
    }
}

// Input Handling
const keys = {};
let lastFireTime = 0;

document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;

    if (e.key === '1') gameState.currentWeapon = 0;
    if (e.key === '2') gameState.currentWeapon = 1;
    if (e.key === '3') gameState.currentWeapon = 2;
    if (e.key === '4') gameState.currentWeapon = 3;
});

document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

document.addEventListener('mousemove', (e) => {
    if (gameState.running) {
        const sensitivity = parseFloat(document.getElementById('sensitivity')?.value || 1);
        const centerX = CANVAS.getBoundingClientRect().width / 2;
        const dx = e.clientX - centerX;
        gameState.angle += (dx * 0.005) * sensitivity;
    }
});

CANVAS.addEventListener('click', () => {
    if (gameState.running) {
        fireWeapon();
    }
});

// Fire Weapon
function fireWeapon() {
    const now = Date.now();
    const weapon = weapons[gameState.currentWeapon];
    const fireRate = weapon.fireRate;

    if (now - lastFireTime < fireRate || weapon.ammo <= 0) return;

    lastFireTime = now;
    weapon.ammo--;

    // Spread for shotgun
    if (gameState.currentWeapon === 1) {
        for (let i = -2; i <= 2; i++) {
            const spread = i * 0.15;
            gameState.projectiles.push(new Projectile(gameState.x, gameState.y, gameState.angle + spread, weapon.damage));
        }
    } else {
        gameState.projectiles.push(new Projectile(gameState.x, gameState.y, gameState.angle, weapon.damage));
    }
}

// Render 3D First-Person View with Raycasting
function render3D() {
    const width = CANVAS.width;
    const height = CANVAS.height;
    
    // Clear canvas
    CTX.fillStyle = '#000';
    CTX.fillRect(0, 0, width, height);

    // Sky (gradient top half)
    const skyGradient = CTX.createLinearGradient(0, 0, 0, height / 2);
    skyGradient.addColorStop(0, '#0a0520');
    skyGradient.addColorStop(1, '#1a0a2e');
    CTX.fillStyle = skyGradient;
    CTX.fillRect(0, 0, width, height / 2);

    // Ground (darker gradient bottom half)
    const groundGradient = CTX.createLinearGradient(0, height / 2, 0, height);
    groundGradient.addColorStop(0, '#1a1a1a');
    groundGradient.addColorStop(1, '#0a0a0a');
    CTX.fillStyle = groundGradient;
    CTX.fillRect(0, height / 2, width, height / 2);

    // Field of view
    const fov = Math.PI / 3; // 60 degrees
    const rayCount = width;
    const rayData = [];

    // Cast rays
    for (let i = 0; i < rayCount; i++) {
        const rayAngle = gameState.angle - fov / 2 + (i / rayCount) * fov;
        let distance = Infinity;
        let hitEnemy = null;
        let wallColor = '#0f0';

        // Raycasting
        for (let step = 0; step < 1000; step++) {
            const d = step * 0.1;
            const x = gameState.x + Math.cos(rayAngle) * d;
            const y = gameState.y + Math.sin(rayAngle) * d;

            // Wall hit
            if (map.isWall(x, y)) {
                distance = d;
                wallColor = Math.random() > 0.7 ? '#00ff00' : '#00cc00';
                break;
            }

            // Enemy hit
            for (let enemy of gameState.enemies) {
                const dx = enemy.x - x;
                const dy = enemy.y - y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 1.5 && d < distance) {
                    distance = d;
                    hitEnemy = enemy;
                    break;
                }
            }
        }

        rayData.push({ distance, hitEnemy, wallColor, rayAngle });
    }

    // Draw walls with depth shading
    for (let i = 0; i < rayData.length; i++) {
        const ray = rayData[i];
        const distance = ray.distance;
        const hitEnemy = ray.hitEnemy;

        if (distance === Infinity) distance = 100;

        // Perspective projection
        const wallHeight = Math.max(5, (height / (distance + 0.5)));
        const x = (i / rayCount) * width;
        const y = (height - wallHeight) / 2;

        // Brightness based on distance
        const brightness = Math.max(50, 255 - (distance * 5));

        if (hitEnemy) {
            // Enemy color: red with brightness variation
            const r = Math.min(255, brightness);
            const g = Math.max(50, brightness * 0.3);
            const b = Math.max(50, brightness * 0.3);
            CTX.fillStyle = `rgb(${r}, ${g}, ${b})`;
            
            // Draw enemy sprite with texture
            CTX.fillRect(x, y, width / rayCount + 1, wallHeight);
            
            // Enemy details
            CTX.fillStyle = '#ff0000';
            CTX.fillRect(x + 2, y + wallHeight * 0.2, width / rayCount - 4, wallHeight * 0.3);
            CTX.fillStyle = '#ffff00';
            CTX.fillRect(x + 3, y + wallHeight * 0.25, width / rayCount - 6, 2);
        } else {
            // Wall with texture effect
            CTX.fillStyle = ray.wallColor;
            CTX.globalAlpha = brightness / 255;
            CTX.fillRect(x, y, width / rayCount + 1, wallHeight);
            
            // Wall details (cracks, etc)
            CTX.globalAlpha = 0.3;
            CTX.fillStyle = '#000000';
            for (let j = 0; j < Math.random() * 3; j++) {
                CTX.fillRect(
                    x + Math.random() * (width / rayCount),
                    y + Math.random() * wallHeight,
                    2,
                    Math.random() * 5
                );
            }
            CTX.globalAlpha = 1;
        }
    }

    // Draw weapon in corner
    drawWeapon();

    // Draw projectiles (if visible)
    for (let projectile of gameState.projectiles) {
        const dx = projectile.x - gameState.x;
        const dy = projectile.y - gameState.y;
        const angle = Math.atan2(dy, dx) - gameState.angle;
        if (Math.abs(angle) < Math.PI / 3) {
            const screenX = (width / 2) + (angle / (Math.PI / 3)) * (width / 2);
            const distance = Math.sqrt(dx * dx + dy * dy);
            const screenY = height / 2 - (distance * 2);
            
            if (screenY > 0 && screenY < height) {
                CTX.fillStyle = '#ffff00';
                CTX.fillRect(screenX - 2, screenY - 2, 4, 4);
            }
        }
    }
}

// Draw Weapon
function drawWeapon() {
    const width = CANVAS.width;
    const height = CANVAS.height;
    const weapon = weapons[gameState.currentWeapon];

    // Weapon frame
    CTX.fillStyle = 'rgba(0, 255, 0, 0.2)';
    CTX.fillRect(width - 80, height - 100, 70, 90);
    
    CTX.strokeStyle = '#0f0';
    CTX.lineWidth = 2;
    CTX.strokeRect(width - 80, height - 100, 70, 90);

    // Weapon icon
    CTX.font = 'bold 40px Arial';
    CTX.fillStyle = '#0f0';
    CTX.textAlign = 'center';
    CTX.fillText(weapon.icon, width - 45, height - 30);

    // Weapon name
    CTX.font = 'bold 10px DOS';
    CTX.fillStyle = '#0f0';
    CTX.textAlign = 'center';
    CTX.fillText(weapon.name, width - 45, height - 60);

    // Ammo count
    CTX.font = 'bold 16px DOS';
    CTX.fillStyle = weapon.ammo === 0 ? '#ff0000' : '#ffff00';
    CTX.textAlign = 'center';
    CTX.fillText(weapon.ammo, width - 45, height - 10);
}

// Render Minimap
function renderMinimap() {
    const scale = MINIMAP_CANVAS.width / map.width;

    MINIMAP_CTX.fillStyle = '#000';
    MINIMAP_CTX.fillRect(0, 0, MINIMAP_CANVAS.width, MINIMAP_CANVAS.height);

    // Draw walls
    MINIMAP_CTX.fillStyle = '#0f0';
    for (let y = 0; y < map.height; y += 5) {
        for (let x = 0; x < map.width; x += 5) {
            if (map.tiles[y][x] === 1) {
                MINIMAP_CTX.fillRect(x * scale, y * scale, scale * 5, scale * 5);
            }
        }
    }

    // Draw enemies
    MINIMAP_CTX.fillStyle = '#ff0000';
    for (let enemy of gameState.enemies) {
        MINIMAP_CTX.beginPath();
        MINIMAP_CTX.arc(enemy.x * scale, enemy.y * scale, 2, 0, Math.PI * 2);
        MINIMAP_CTX.fill();
    }

    // Draw player
    MINIMAP_CTX.fillStyle = '#ffff00';
    MINIMAP_CTX.beginPath();
    MINIMAP_CTX.arc(gameState.x * scale, gameState.y * scale, 3, 0, Math.PI * 2);
    MINIMAP_CTX.fill();

    // Draw player direction
    MINIMAP_CTX.strokeStyle = '#ffff00';
    MINIMAP_CTX.beginPath();
    MINIMAP_CTX.moveTo(gameState.x * scale, gameState.y * scale);
    MINIMAP_CTX.lineTo(
        (gameState.x + Math.cos(gameState.angle) * 8) * scale,
        (gameState.y + Math.sin(gameState.angle) * 8) * scale
    );
    MINIMAP_CTX.stroke();
}

// Game Loop
function gameLoop() {
    gameState.time++;

    // Movement with collision
    const moveSpeed = 0.8;
    if (keys['w'] || keys['arrowup']) {
        const newX = gameState.x + Math.cos(gameState.angle) * moveSpeed;
        const newY = gameState.y + Math.sin(gameState.angle) * moveSpeed;
        if (!map.isWall(newX, newY) && !map.isWall(newX + 2, newY) && !map.isWall(newX - 2, newY)) {
            gameState.x = newX;
            gameState.y = newY;
        }
    }
    if (keys['s'] || keys['arrowdown']) {
        const newX = gameState.x - Math.cos(gameState.angle) * moveSpeed;
        const newY = gameState.y - Math.sin(gameState.angle) * moveSpeed;
        if (!map.isWall(newX, newY) && !map.isWall(newX + 2, newY) && !map.isWall(newX - 2, newY)) {
            gameState.x = newX;
            gameState.y = newY;
        }
    }
    if (keys['a'] || keys['arrowleft']) {
        gameState.angle -= 0.08;
    }
    if (keys['d'] || keys['arrowright']) {
        gameState.angle += 0.08;
    }

    // Update enemies
    for (let enemy of gameState.enemies) {
        enemy.update();
    }

    // Update projectiles
    gameState.projectiles = gameState.projectiles.filter(p => p.life > 0);
    for (let projectile of gameState.projectiles) {
        projectile.update();
    }

    // Update UI
    document.getElementById('health').textContent = Math.max(0, gameState.health) + '%';
    document.getElementById('armor').textContent = gameState.armor + '%';
    document.getElementById('weaponName').textContent = weapons[gameState.currentWeapon].name;
    document.getElementById('ammoCount').textContent = weapons[gameState.currentWeapon].ammo;

    // Update weapon selection UI
    document.querySelectorAll('.weapon-slot').forEach((slot, i) => {
        if (i === gameState.currentWeapon) {
            slot.classList.add('active');
        } else {
            slot.classList.remove('active');
        }
    });

    // Game over check
    if (gameState.health <= 0) {
        gameState.running = false;
        alert(`GAME OVER!\n\nKills: ${gameState.kills}\nTime: ${Math.floor(gameState.time / 60)}s`);
        document.getElementById('mainMenu').classList.remove('hidden');
        return;
    }

    // Spawn more enemies
    if (gameState.enemies.length < 3 && Math.random() > 0.98) {
        let x, y;
        do {
            x = Math.random() * (map.width - 40) + 20;
            y = Math.random() * (map.height - 40) + 20;
        } while (map.isWall(x, y) || (Math.abs(x - gameState.x) < 30 && Math.abs(y - gameState.y) < 30));
        gameState.enemies.push(new Enemy(x, y));
    }

    // Render
    render3D();
    renderMinimap();

    if (gameState.running) {
        requestAnimationFrame(gameLoop);
    }
}

// Start Game
function startGame() {
    difficulty = document.getElementById('difficulty').value || 'NORMAL';
    
    document.getElementById('mainMenu').classList.add('hidden');
    gameState.running = true;
    gameState.gameStarted = true;
    gameState.health = 100;
    gameState.armor = 25;
    gameState.kills = 0;
    gameState.time = 0;
    
    // Reset weapons
    weapons.forEach(w => w.ammo = w.maxAmmo);
    gameState.currentWeapon = 0;
    
    // Spawn initial enemies based on difficulty
    gameState.enemies = [];
    const enemyCount = difficulty === 'EASY' ? 3 : difficulty === 'NORMAL' ? 5 : 8;
    
    for (let i = 0; i < enemyCount; i++) {
        let x, y;
        do {
            x = Math.random() * (map.width - 40) + 20;
            y = Math.random() * (map.height - 40) + 20;
        } while (map.isWall(x, y) || (Math.abs(x - gameState.x) < 40 && Math.abs(y - gameState.y) < 40));
        gameState.enemies.push(new Enemy(x, y));
    }

    gameLoop();
}

// Menu Functions
function showSettings() {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('settingsMenu').classList.remove('hidden');
    document.getElementById('difficulty').value = 'NORMAL';
}

function hideSettings() {
    document.getElementById('settingsMenu').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
}

function showAbout() {
    alert('D00M BROWSER EDITION\n\nEen eerste-persoons shooter\nGeïnspireerd op de klasieke DOOM\n\nBESTURING:\nWASD/Pijlen: Bewegen\nMuis: Kijken rond\nMuisklik: Schieten\n1-4: Wapen selectie\n\nWapens:\n1 = PISTOL\n2 = SHOTGUN\n3 = ROCKET LAUNCHER\n4 = BFG\n\nVeel plezier!');
}

// Initialize
window.addEventListener('load', () => {
    console.log('D00M Browser Edition geladen!');
    document.getElementById('difficulty').value = 'NORMAL';
});