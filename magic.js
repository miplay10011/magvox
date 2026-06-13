// magic.js – универсальный движок через снаряды
export const SPELL_ELEMENTS = ['fire','water','air','earth','beam','ice','shield','light','dark'];
export const CONFLICTS = [['fire','water'],['fire','ice'],['light','dark']];
export const MANA_PER_ELEMENT = 1, CAST_COOLDOWN = 500;

export function createMagicEngine(ctx) {
  const projectiles = new Map(), lastCast = new Map();
  let nextProj = 1;

  function validate(els) {
    if (!Array.isArray(els) || els.length < 1 || els.length > 5) return false;
    if (!els.every(e => SPELL_ELEMENTS.includes(e))) return false;
    for (const [a, b] of CONFLICTS)
      if (els.includes(a) && els.includes(b)) return false;
    return true;
  }

  // Взрыв (общая функция)
  function explode(x, y, z, radius, dmg, ownerId, extraEffect = null) {
    radius = Math.min(radius, 6);
    ctx.emit('explosion', { x, y, z, r: radius });
    const r = Math.ceil(radius);
    // Разрушение блоков
    for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++)
      for (let by = Math.max(1, Math.floor(y - r)); by <= Math.floor(y + r); by++)
        for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++) {
          const d2 = (bx + 0.5 - x) ** 2 + (by + 0.5 - y) ** 2 + (bz + 0.5 - z) ** 2;
          if (d2 <= radius * radius && ctx.getBlock(bx, by, bz) !== 0)
            ctx.setBlock(bx, by, bz, 0);
        }
    // Урон игрокам
    const rr = radius * 1.6;
    for (const [id, p] of ctx.getPlayers()) {
      if (id === ownerId) continue;
      const d2 = (p.x - x) ** 2 + (p.y + 0.9 - y) ** 2 + (p.z - z) ** 2;
      if (d2 < rr * rr) {
        const actualDmg = dmg * (1 - Math.sqrt(d2) / rr);
        ctx.applyDamage(id, actualDmg, {
          ax: x, az: z, kb: 6 + radius,
          attackerId: ownerId,
          weapon: 'магии'
        });
      }
    }
    if (extraEffect) extraEffect(x, y, z);
  }

  // Создание снаряда
  function spawnProjectile(owner, kind, x, y, z, vx, vy, vz, opts = {}) {
    const id = nextProj++;
    const proj = {
      id, owner, kind,
      x, y, z, vx, vy, vz,
      ttl: 5,
      gravity: opts.gravity || false,
      explosive: opts.explosive || false,
      radius: opts.radius || 0,
      dmg: opts.dmg || 0,
      scale: opts.scale || 1,
      onHit: opts.onHit || null   // функция обратного вызова при попадании
    };
    projectiles.set(id, proj);
    ctx.emit('projSpawn', {
      id, kind,
      x, y, z, vx, vy, vz,
      gravity: proj.gravity,
      scale: proj.scale
    });
  }

  // Основной каст
  function cast(casterId, els, dirArr, origin, yaw) {
    if (!validate(els)) return;
    const now = Date.now();
    if (now - (lastCast.get(casterId) || 0) < CAST_COOLDOWN) return;
    const cost = els.length * MANA_PER_ELEMENT;
    if (ctx.getMana(casterId) < cost) return;
    lastCast.set(casterId, now);
    ctx.spendMana(casterId, cost);

    const n = e => els.filter(x => x === e).length;
    const len = els.length;
    let [dx, dy, dz] = dirArr || [0, 0, -1];
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    const ox = origin.x, oy = origin.y, oz = origin.z;

    // Определяем доминирующий элемент
    let dominant = 'fire';
    let maxCount = 0;
    for (const e of els) {
      if (n(e) > maxCount) { maxCount = n(e); dominant = e; }
    }

    // Базовый урон
    let baseDmg = els.length * 3;
    if (n('fire')) baseDmg += n('fire') * 2;
    if (n('earth')) baseDmg += n('earth') * 2;
    if (n('ice')) baseDmg += n('ice') * 1;
    if (n('dark')) baseDmg += n('dark') * 2;
    if (n('light')) baseDmg += n('light') * 1;

    const explosive = n('fire') > 0 && n('earth') > 0;
    const isMeteor = n('beam') > 0 && n('fire') > 0 && n('earth') > 0;
    const isHeal = n('light') >= 2 && n('light') >= len/2;
    const isShield = n('shield') > 0;
    const isTotem = n('earth') === 1 && n('beam') === 1 && n('air') === 1;
    const isAsteroid = n('fire') === 1 && n('earth') === 1 && n('dark') === 1 && n('beam') === 1 && n('air') === 1;

    // Мгновенные заклинания (без снаряда)
    if (isHeal) {
      ctx.clearDebuffs(casterId);
      ctx.healPlayer(casterId, baseDmg);
      return;
    }
    if (isShield) {
      ctx.addEffect(casterId, 'ward', 10, { power: baseDmg });
      return;
    }
    if (n('air') && n('dark')) {
      const dist = 8 + 3 * n('air');
      const tx = ox + dx * dist, tz = oz + dz * dist;
      const ty = Math.max(ctx.terrainHeight(Math.floor(tx), Math.floor(tz)), 1);
      ctx.teleportPlayer(casterId, tx, ty, tz);
      ctx.emit('teleportFx', { x0: ox, y0: oy - 1, z0: oz, x1: tx, y1: ty + 1, z1: tz });
      return;
    }

    // Снаряды
    const speed = 25;
    const vx = dx * speed;
    const vy = dy * speed;
    const vz = dz * speed;

    if (isMeteor) {
      // Метеор: спавним высоко в небе над целью
      const targetX = ox + dx * 10;
      const targetZ = oz + dz * 10;
      spawnProjectile(casterId, 'meteor', targetX, 50, targetZ, 0, -20, 0, {
        gravity: true,
        explosive: true,
        radius: 3 + n('earth'),
        dmg: baseDmg,
        scale: 2
      });
      return;
    }

    if (isTotem) {
      // Тотем: снаряд, который при попадании в землю создаёт тотем
      const totemRadius = len === 4 ? 7 : 5;
      const totemDuration = len === 4 ? 45 : 30;
      spawnProjectile(casterId, 'totem', ox + dx, oy + dy, oz + dz, vx, vy, vz, {
        gravity: true,
        explosive: false,
        onHit: (x, y, z) => {
          ctx.addTotem(casterId, x, z, totemRadius, totemDuration);
        }
      });
      return;
    }

    if (isAsteroid) {
      // Астероид: снаряд, который падает и вызывает взрыв с воронкой
      const impactX = ox + dx * 8;
      const impactZ = oz + dz * 8;
      spawnProjectile(casterId, 'asteroid', impactX, 60, impactZ, 0, -15, 0, {
        gravity: true,
        onHit: (x, y, z) => {
          ctx.summonAsteroid(casterId, x, z, yaw);
        }
      });
      return;
    }

    // Обычный снаряд
    let radius = 0;
    if (explosive) radius = 1.5 + n('earth') * 0.5;
    spawnProjectile(casterId, dominant, ox + dx, oy + dy, oz + dz, vx, vy, vz, {
      gravity: false,
      explosive: explosive,
      radius: radius,
      dmg: baseDmg
    });
  }

  // Обновление снарядов
  function tick(dt) {
    for (const [id, pr] of projectiles) {
      pr.ttl -= dt;
      if (pr.gravity) pr.vy -= 20 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;

      // Проверка попадания в игрока
      let hitPlayer = null;
      for (const [pid, p] of ctx.getPlayers()) {
        if (pid === pr.owner) continue;
        const dx = p.x - pr.x;
        const dy = p.y + 0.9 - pr.y;
        const dz = p.z - pr.z;
        if (dx*dx + dy*dy + dz*dz < 1.5) {
          hitPlayer = pid;
          break;
        }
      }
      const hitBlock = ctx.getBlock(Math.floor(pr.x), Math.floor(pr.y), Math.floor(pr.z)) !== 0;
      const expired = pr.ttl <= 0 || pr.y < 0;

      if (expired || hitPlayer !== null || hitBlock) {
        projectiles.delete(id);
        ctx.emit('projEnd', { id, x: pr.x, y: pr.y, z: pr.z });
        if (pr.explosive) {
          explode(pr.x, pr.y, pr.z, pr.radius, pr.dmg, pr.owner);
        } else if (hitPlayer !== null) {
          ctx.applyDamage(hitPlayer, pr.dmg, {
            ax: pr.x - pr.vx, az: pr.z - pr.vz,
            kb: 5, attackerId: pr.owner, weapon: 'магии'
          });
        } else if (pr.onHit) {
          pr.onHit(pr.x, pr.y, pr.z);
        }
      }
    }
  }

  function getSnapshot() {
    return {
      projectiles: [...projectiles.values()].map(p => ({
        id: p.id, kind: p.kind, x: p.x, y: p.y, z: p.z,
        vx: p.vx, vy: p.vy, vz: p.vz, gravity: p.gravity,
        explosive: p.explosive, radius: p.radius, dmg: p.dmg, scale: p.scale
      })),
      mines: []
    };
  }

  return { cast, tick, validate, getSnapshot };
}