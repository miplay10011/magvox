// enemies.js
// Константы направлений
const AIR = 0;

export class Enemy {
    constructor(manager, id, type, x, y, z) {
        this.manager = manager;
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.z = z;
        this.health = type.health;
        this.maxHealth = type.health;
        this.target = null;          // цель (игрок)
        this.lastAttack = 0;
        this.lastDamageTime = 0;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.onGround = false;
        this.knockback = { x: 0, z: 0 };
        this.yaw = 0;
        this.lastSync = 0;
    }

    update(dt, players, getBlock, getHeight) {
        if (this.health <= 0) return;

        // Поиск ближайшего игрока в радиусе followRange
        if (!this.target || !players.has(this.target.id)) {
            this.acquireTarget(players);
        }

        if (this.target) {
            const dx = this.target.x - this.x;
            const dz = this.target.z - this.z;
            const distSq = dx*dx + dz*dz;
            const attackRange = this.type.attackRange;
            const followRange = this.type.followRange;

            if (distSq <= attackRange * attackRange) {
                this.attackTarget();
            } else if (distSq <= followRange * followRange) {
                this.moveTowards(dx, dz, dt);
            } else {
                if (Math.random() < 0.02) this.randomWalk(dt);
            }
        } else {
            if (Math.random() < 0.02) this.randomWalk(dt);
        }

        // Гравитация и коллизии
        if (!this.type.flying) {
            this.velocity.y -= 20 * dt;
            this.y += this.velocity.y * dt;
            this.resolveVerticalCollision(getBlock);
        } else {
            // летающий – держится на высоте terrainHeight + 2
            const groundY = getHeight(this.x, this.z);
            this.y = groundY + 2;
            this.velocity.y = 0;
        }

        // Горизонтальное движение
        let moveX = (this.velocity.x + this.knockback.x) * dt;
        let moveZ = (this.velocity.z + this.knockback.z) * dt;
        this.x += moveX;
        this.z += moveZ;
        this.resolveHorizontalCollision(getBlock);

        // Затухание
        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
        this.knockback.x *= 0.8;
        this.knockback.z *= 0.8;

        // Границы мира
        this.x = Math.max(0.5, Math.min(1000, this.x));
        this.z = Math.max(0.5, Math.min(1000, this.z));
        this.y = Math.max(1, Math.min(200, this.y));
    }

    acquireTarget(players) {
        let closest = null;
        let bestDist = Infinity;
        for (const [id, p] of players) {
            const dx = p.x - this.x;
            const dz = p.z - this.z;
            const distSq = dx*dx + dz*dz;
            if (distSq < bestDist && distSq < this.type.followRange * this.type.followRange) {
                bestDist = distSq;
                closest = { id, x: p.x, z: p.z, isPlayer: true };
            }
        }
        this.target = closest;
    }

    moveTowards(dx, dz, dt) {
        const len = Math.hypot(dx, dz);
        if (len < 0.01) return;
        const normX = dx / len;
        const normZ = dz / len;
        const speed = this.type.speed;
        this.velocity.x = normX * speed;
        this.velocity.z = normZ * speed;
        this.yaw = Math.atan2(normX, normZ);
    }

    randomWalk(dt) {
        const angle = Math.random() * Math.PI * 2;
        this.velocity.x = Math.cos(angle) * this.type.speed * 0.5;
        this.velocity.z = Math.sin(angle) * this.type.speed * 0.5;
    }

    attackTarget() {
        const now = Date.now();
        if (now - this.lastAttack < this.type.attackCooldown * 1000) return;
        this.lastAttack = now;

        if (this.type.ranged) {
            // дальняя атака: стреляем снарядом через магическую систему
            this.manager.shootProjectile(this, this.target);
        } else {
            // ближняя атака
            const dmg = this.type.damage;
            const player = this.manager.players.get(this.target.id);
            if (player && this.distanceTo(player) < this.type.attackRange) {
                this.manager.applyDamageToPlayer(this.target.id, dmg, {
                    ax: this.x, az: this.z,
                    kb: this.type.knockback,
                    attackerId: null,
                    weapon: this.type.name
                });
                // эффекты при ударе
                if (this.type.effects) {
                    for (const [eff, dur] of Object.entries(this.type.effects)) {
                        this.manager.addEffectToPlayer(this.target.id, eff, dur, 1);
                    }
                }
                this.manager.broadcast('enemyAttack', {
                    id: this.id,
                    targetId: this.target.id,
                    type: this.type.id
                });
            }
        }
    }

    distanceTo(entity) {
        const dx = this.x - entity.x;
        const dz = this.z - entity.z;
        return Math.hypot(dx, dz);
    }

    resolveVerticalCollision(getBlock) {
        const half = 0.4;
        const feetY = Math.floor(this.y);
        const headY = Math.floor(this.y + 1.6);
        const minX = Math.floor(this.x - half);
        const maxX = Math.floor(this.x + half);
        const minZ = Math.floor(this.z - half);
        const maxZ = Math.floor(this.z + half);
        for (let y = feetY; y <= headY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (getBlock(x, y, z) !== AIR) {
                        if (this.velocity.y < 0) {
                            this.y = y + 1;
                            this.onGround = true;
                            this.velocity.y = 0;
                        } else if (this.velocity.y > 0) {
                            this.y = y - 1.6;
                            this.velocity.y = 0;
                        }
                        return;
                    }
                }
            }
        }
        this.onGround = false;
    }

    resolveHorizontalCollision(getBlock) {
        const half = 0.4;
        const minX = Math.floor(this.x - half);
        const maxX = Math.floor(this.x + half);
        const minZ = Math.floor(this.z - half);
        const maxZ = Math.floor(this.z + half);
        const feetY = Math.floor(this.y);
        const headY = Math.floor(this.y + 1.6);
        for (let y = feetY; y <= headY; y++) {
            for (let x = minX; x <= maxX; x++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (getBlock(x, y, z) !== AIR) {
                        const dx = this.x - (x + 0.5);
                        const dz = this.z - (z + 0.5);
                        const adx = Math.abs(dx);
                        const adz = Math.abs(dz);
                        if (adx > adz) {
                            this.x = (dx > 0 ? x + 1 + half : x - half);
                        } else {
                            this.z = (dz > 0 ? z + 1 + half : z - half);
                        }
                        return;
                    }
                }
            }
        }
    }
}

// ТИПЫ ВРАГОВ (легко добавлять новые)
export const ENEMY_TYPES = {
    zombie: {
        id: 'zombie',
        name: 'Зомби',
        health: 20,
        damage: 4,
        speed: 2.5,
        attackRange: 1.8,
        followRange: 20,
        attackCooldown: 1.0,
        knockback: 6,
        flying: false,
        ranged: false,
        effects: { weakness: 5 }
    },
    skeleton: {
        id: 'skeleton',
        name: 'Скелет',
        health: 18,
        damage: 6,
        speed: 2.2,
        attackRange: 12,
        followRange: 25,
        attackCooldown: 1.5,
        knockback: 3,
        flying: false,
        ranged: true,
        projectileElements: ['fire', 'fire'],
        effects: {}
    },
    creeper: {
        id: 'creeper',
        name: 'Крипер',
        health: 24,
        damage: 12,
        speed: 1.8,
        attackRange: 2.5,
        followRange: 16,
        attackCooldown: 2.0,
        knockback: 12,
        flying: false,
        ranged: false,
        explosive: true,
        explosionRadius: 4,
        effects: {}
    },
    ghost: {
        id: 'ghost',
        name: 'Призрак',
        health: 14,
        damage: 5,
        speed: 3.5,
        attackRange: 2.0,
        followRange: 18,
        attackCooldown: 0.8,
        knockback: 2,
        flying: true,
        ranged: false,
        effects: { slow: 3, blind: 2 }
    },
    fireElemental: {
        id: 'fireElemental',
        name: 'Огненный элементаль',
        health: 30,
        damage: 8,
        speed: 2.2,
        attackRange: 5,
        followRange: 20,
        attackCooldown: 1.2,
        knockback: 5,
        flying: false,
        ranged: true,
        projectileElements: ['fire', 'fire', 'air'],
        effects: { burning: 4 }
    }
};

export class EnemyManager {
    constructor(players, getBlock, getHeight, applyDamageFunc, addEffectFunc, broadcastFunc, magic) {
        this.players = players;
        this.getBlock = getBlock;
        this.getHeight = getHeight;
        this.applyDamageToPlayer = applyDamageFunc;
        this.addEffectToPlayer = addEffectFunc;
        this.broadcast = broadcastFunc;
        this.magic = magic;
        this.enemies = new Map();
        this.nextId = 1000;
        this.maxEnemies = 40;
        this.spawnCooldown = 0;
    }

    update(dt) {
        const now = Date.now();
        // Обновление каждого врага
        for (const enemy of this.enemies.values()) {
            enemy.update(dt, this.players, this.getBlock, this.getHeight);
            if (!enemy.lastSync || now - enemy.lastSync > 200) {
                enemy.lastSync = now;
                this.broadcast('enemyMove', {
                    id: enemy.id,
                    x: enemy.x,
                    y: enemy.y,
                    z: enemy.z,
                    yaw: enemy.yaw || 0
                });
            }
            if (enemy.health <= 0) this.destroyEnemy(enemy.id);
        }

        // Спавн новых врагов
        if (this.enemies.size < this.maxEnemies) {
            if (this.spawnCooldown <= 0) {
                this.trySpawnEnemy();
                this.spawnCooldown = 5;
            } else {
                this.spawnCooldown -= dt;
            }
        }
    }

    trySpawnEnemy() {
        const playerList = [...this.players.values()];
        if (playerList.length === 0) return;
        const targetPlayer = playerList[Math.floor(Math.random() * playerList.length)];
        for (let attempt = 0; attempt < 20; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 30;
            const x = targetPlayer.x + Math.cos(angle) * dist;
            const z = targetPlayer.z + Math.sin(angle) * dist;
            const groundY = this.getHeight(x, z);
            const y = groundY + 1;
            if (this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)) === AIR &&
                this.getBlock(Math.floor(x), Math.floor(y) + 1, Math.floor(z)) === AIR) {
                const typeKeys = Object.keys(ENEMY_TYPES);
                const randType = ENEMY_TYPES[typeKeys[Math.floor(Math.random() * typeKeys.length)]];
                this.spawnEnemy(randType, x, y, z);
                return;
            }
        }
    }

    spawnEnemy(type, x, y, z) {
        const id = this.nextId++;
        const enemy = new Enemy(this, id, type, x, y, z);
        this.enemies.set(id, enemy);
        this.broadcast('enemySpawn', {
            id: enemy.id,
            type: type.id,
            x: enemy.x,
            y: enemy.y,
            z: enemy.z,
            health: enemy.health,
            maxHealth: enemy.maxHealth
        });
        console.log(`Spawned ${type.name} #${id} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
        return enemy;
    }

    destroyEnemy(id) {
        const enemy = this.enemies.get(id);
        if (!enemy) return;
        this.broadcast('enemyDeath', { id });
        this.enemies.delete(id);
        // Можно добавить дроп предметов
    }

    damageEnemy(id, amount, sourceX, sourceZ, knockback = 5) {
        const enemy = this.enemies.get(id);
        if (!enemy) return;
        const now = Date.now();
        if (now - enemy.lastDamageTime < 200) return;
        enemy.lastDamageTime = now;
        enemy.health -= amount;
        const dx = enemy.x - sourceX;
        const dz = enemy.z - sourceZ;
        const len = Math.hypot(dx, dz);
        if (len > 0.01) {
            const normX = dx / len;
            const normZ = dz / len;
            enemy.knockback.x += normX * knockback;
            enemy.knockback.z += normZ * knockback;
        }
        this.broadcast('enemyHp', { id, health: Math.max(0, enemy.health), maxHealth: enemy.maxHealth });
        if (enemy.health <= 0) this.destroyEnemy(id);
    }

    shootProjectile(enemy, target) {
        // Создаём фейкового кастера (врага) и используем магическую систему
        const fakeCaster = {
            id: `enemy_${enemy.id}`,
            x: enemy.x,
            y: enemy.y + 1.2,
            z: enemy.z,
            yaw: Math.atan2(target.x - enemy.x, target.z - enemy.z)
        };
        const dirX = target.x - enemy.x;
        const dirZ = target.z - enemy.z;
        const len = Math.hypot(dirX, dirZ);
        const dir = [dirX / len, 0, dirZ / len];
        if (this.magic && this.magic.castProjectile) {
            this.magic.castProjectile(fakeCaster, enemy.type.projectileElements, dir, { x: enemy.x, y: enemy.y+1.2, z: enemy.z }, enemy.yaw, 'left');
        } else {
            // fallback: прямой урон
            this.applyDamageToPlayer(target.id, enemy.type.damage, {
                ax: enemy.x, az: enemy.z, kb: 0, attackerId: null, weapon: enemy.type.name
            });
        }
    }

    getEnemyData() {
        return [...this.enemies.values()].map(e => ({
            id: e.id,
            type: e.type.id,
            x: e.x,
            y: e.y,
            z: e.z,
            health: e.health,
            maxHealth: e.maxHealth
        }));
    }
}