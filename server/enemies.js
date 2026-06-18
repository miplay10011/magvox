// enemies.js
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
        this.target = null;
        this.lastAttack = 0;
        this.lastDamageTime = 0;
        this.velocity = { x: 0, y: 0, z: 0 };
        this.onGround = false;
        this.knockback = { x: 0, z: 0 };
        this.yaw = 0;
        this.lastSync = 0;
        this.width = 0.7;
        this.height = 1.6;
        this.stuckTimer = 0;
        this.prevPos = { x, z };
    }

    update(dt, players, getBlock, getHeight) {
        if (this.health <= 0) return;

        if (!this.target || !players.has(this.target.id)) {
            this.acquireTarget(players);
        }

        if (this.target) {
            const dx = this.target.x - this.x;
            const dz = this.target.z - this.z;
            const dist = Math.hypot(dx, dz);
            const attackRange = this.type.attackRange;
            const followRange = this.type.followRange;

            if (dist <= attackRange) {
                this.attackTarget();
            } else if (dist <= followRange) {
                this.moveTowards(dx, dz, dt);
            } else {
                this.randomWalk(dt);
            }
        } else {
            this.randomWalk(dt);
        }

        if (!this.type.flying) {
            this.velocity.y -= 20 * dt;
            this.y += this.velocity.y * dt;
            this.resolveVerticalCollision(getBlock);
        } else {
            const groundY = getHeight(this.x, this.z);
            this.y = groundY + 2;
            this.velocity.y = 0;
        }

        const moveX = (this.velocity.x + this.knockback.x) * dt;
        const moveZ = (this.velocity.z + this.knockback.z) * dt;
        this.x += moveX;
        this.z += moveZ;
        this.resolveHorizontalCollision(getBlock);

        this.velocity.x *= 0.9;
        this.velocity.z *= 0.9;
        this.knockback.x *= 0.8;
        this.knockback.z *= 0.8;

        this.x = Math.max(0.5, Math.min(1000, this.x));
        this.z = Math.max(0.5, Math.min(1000, this.z));
        this.y = Math.max(1, Math.min(200, this.y));

        if (!this.lastSync || Date.now() - this.lastSync > 200) {
            this.lastSync = Date.now();
            this.manager.broadcast('enemyMove', {
                id: this.id,
                x: this.x,
                y: this.y,
                z: this.z,
                yaw: this.yaw
            });
        }

        const moved = Math.hypot(this.x - this.prevPos.x, this.z - this.prevPos.z);
        if (moved < 0.01) {
            this.stuckTimer += dt;
            if (this.stuckTimer > 2) {
                this.y += 0.5;
                this.stuckTimer = 0;
            }
        } else {
            this.stuckTimer = 0;
        }
        this.prevPos.x = this.x;
        this.prevPos.z = this.z;
    }

    acquireTarget(players) {
        let closest = null;
        let bestDist = Infinity;
        const range = this.type.followRange;
        for (const [id, p] of players) {
            const dx = p.x - this.x;
            const dz = p.z - this.z;
            const distSq = dx*dx + dz*dz;
            if (distSq < bestDist && distSq < range * range) {
                bestDist = distSq;
                closest = { id, x: p.x, z: p.z, isPlayer: true };
            }
        }
        this.target = closest;
    }

    moveTowards(dx, dz, dt) {
        const len = Math.hypot(dx, dz);
        if (len < 0.01) return;
        const speed = this.type.speed;
        const normX = dx / len;
        const normZ = dz / len;
        this.velocity.x += (normX * speed - this.velocity.x) * 0.2;
        this.velocity.z += (normZ * speed - this.velocity.z) * 0.2;
        this.yaw = Math.atan2(normX, normZ);
    }

    randomWalk(dt) {
        if (Math.random() < 0.02) {
            const angle = Math.random() * Math.PI * 2;
            this.velocity.x += Math.cos(angle) * this.type.speed * 0.3;
            this.velocity.z += Math.sin(angle) * this.type.speed * 0.3;
        }
    }

    attackTarget() {
        const now = Date.now();
        if (now - this.lastAttack < this.type.attackCooldown * 1000) return;

        const player = this.manager.players.get(this.target.id);
        if (!player) return;

        const dist = this.distanceTo(player);
        if (dist >= this.type.attackRange) return;

        this.lastAttack = now;
        const dmg = this.type.damage;
        this.manager.applyDamageToPlayer(this.target.id, dmg, {
            ax: this.x, az: this.z,
            kb: this.type.knockback,
            attackerId: null,
            weapon: this.type.name
        });

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

    distanceTo(entity) {
        const dx = this.x - entity.x;
        const dz = this.z - entity.z;
        return Math.hypot(dx, dz);
    }

    resolveVerticalCollision(getBlock) {
        const half = this.width / 2;
        const feetY = Math.floor(this.y);
        const headY = Math.floor(this.y + this.height);
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
                            this.y = y - this.height;
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
        const half = this.width / 2;
        const feetY = Math.floor(this.y);
        const headY = Math.floor(this.y + this.height);
        const minX = Math.floor(this.x - half);
        const maxX = Math.floor(this.x + half);
        const minZ = Math.floor(this.z - half);
        const maxZ = Math.floor(this.z + half);

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
                        if (adx > adz) this.velocity.x = 0;
                        else this.velocity.z = 0;
                        return;
                    }
                }
            }
        }
    }
}

export const ENEMY_TYPES = {
    zombie: {
        id: 'zombie',
        name: 'Зомби',
        health: 20,
        damage: 4,
        speed: 2.5,
        attackRange: 1.8,
        followRange: 30,
        attackCooldown: 1.0,
        knockback: 6,
        flying: false,
        effects: { weakness: 5 }
    },
    skeleton: {
        id: 'skeleton',
        name: 'Скелет',
        health: 18,
        damage: 6,
        speed: 2.2,
        attackRange: 15,
        followRange: 35,
        attackCooldown: 1.5,
        knockback: 3,
        flying: false,
        effects: {}
    },
    creeper: {
        id: 'creeper',
        name: 'Крипер',
        health: 24,
        damage: 12,
        speed: 1.8,
        attackRange: 2.5,
        followRange: 25,
        attackCooldown: 2.0,
        knockback: 12,
        flying: false,
        effects: {}
    },
    ghost: {
        id: 'ghost',
        name: 'Призрак',
        health: 14,
        damage: 5,
        speed: 3.5,
        attackRange: 2.0,
        followRange: 25,
        attackCooldown: 0.8,
        knockback: 2,
        flying: true,
        effects: { slow: 3, blind: 2 }
    },
    fireElemental: {
        id: 'fireElemental',
        name: 'Огненный элементаль',
        health: 30,
        damage: 8,
        speed: 2.2,
        attackRange: 5,
        followRange: 25,
        attackCooldown: 1.2,
        knockback: 5,
        flying: false,
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
        console.log('[EnemyManager] Инициализирован');
    }

    update(dt) {
        for (const enemy of this.enemies.values()) {
            enemy.update(dt, this.players, this.getBlock, this.getHeight);
            if (enemy.health <= 0) this.destroyEnemy(enemy.id);
        }

        if (this.enemies.size < this.maxEnemies && this.spawnCooldown <= 0) {
            this.trySpawnEnemy();
            this.spawnCooldown = 3;
        } else {
            this.spawnCooldown -= dt;
        }

        if (!this._logTimer || Date.now() - this._logTimer > 10000) {
            this._logTimer = Date.now();
            console.log(`[EnemyManager] Врагов: ${this.enemies.size}, игроков: ${this.players.size}`);
        }
    }

    trySpawnEnemy() {
        const playerList = [...this.players.values()];
        if (playerList.length === 0) return;
        const targetPlayer = playerList[Math.floor(Math.random() * playerList.length)];

        for (let attempt = 0; attempt < 30; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 25;
            const x = targetPlayer.x + Math.cos(angle) * dist;
            const z = targetPlayer.z + Math.sin(angle) * dist;
            const groundY = this.getHeight(x, z);
            const y = groundY + 1;
            const block1 = this.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
            const block2 = this.getBlock(Math.floor(x), Math.floor(y) + 1, Math.floor(z));
            if (block1 === AIR && block2 === AIR) {
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
        console.log(`[EnemyManager] Спавн ${type.name} #${id} at (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)})`);
        return enemy;
    }

    destroyEnemy(id) {
        const enemy = this.enemies.get(id);
        if (!enemy) return;
        this.broadcast('enemyDeath', { id });
        this.enemies.delete(id);
        console.log(`[EnemyManager] Враг #${id} уничтожен`);
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
            enemy.knockback.x += (dx / len) * knockback;
            enemy.knockback.z += (dz / len) * knockback;
        }
        this.broadcast('enemyHp', { id, health: Math.max(0, enemy.health), maxHealth: enemy.maxHealth });
        if (enemy.health <= 0) this.destroyEnemy(id);
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