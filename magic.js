// magic.js – исправленная версия (луч работает)
export const SPELL_ELEMENTS = ['fire','water','air','earth','beam','ice','shield','light','dark'];
export const MANA_PER_ELEMENT = 1, CAST_COOLDOWN = 500;

export function createMagicEngine(ctx) {
  const projectiles = new Map(), mines = new Map(), lastCast = new Map();
  let nextProj = 1, nextMine = 1;

  const dominant = (els, n) => {
    let best = 'beam', bc = 0;
    for (const e of els) {
      if (e === 'beam' || e === 'shield') continue;
      if (n(e) > bc) { best = e; bc = n(e); }
    }
    return best;
  };

  function validate(els) {
  if (!Array.isArray(els) || els.length < 1 || els.length > 5) return false;
  if (!els.every(e => SPELL_ELEMENTS.includes(e))) return false;
  return true;
}

  function explode(x, y, z, radius, dmg, ownerId, extraEffect = null) {
    radius = Math.min(radius, 6);
    ctx.emit('explosion', { x, y, z, r: radius });
    const r = Math.ceil(radius);
    for (let bx = Math.floor(x - r); bx <= Math.floor(x + r); bx++)
      for (let by = Math.max(1, Math.floor(y - r)); by <= Math.floor(y + r); by++)
        for (let bz = Math.floor(z - r); bz <= Math.floor(z + r); bz++) {
          const d2 = (bx + 0.5 - x) ** 2 + (by + 0.5 - y) ** 2 + (bz + 0.5 - z) ** 2;
          if (d2 <= radius * radius && ctx.getBlock(bx, by, bz) !== 0)
            ctx.setBlock(bx, by, bz, 0);
        }
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

  function applyElementEffects(targetId, n, attackerId) {
    if (n('fire')) ctx.addEffect(targetId, 'burning', 3, n('fire'));
    if (n('ice'))  ctx.addEffect(targetId, n('ice') >= 3 ? 'freeze' : 'slow', n('ice') >= 3 ? 1.5 : 4, n('ice'));
    if (n('dark')) ctx.addEffect(targetId, 'curse', 6 + 2 * n('dark'), n('dark'));
  }

  function spawnProjectile(owner, kind, x, y, z, vx, vy, vz, opts = {}) {
    const id = nextProj++;
    const proj = {
      id, owner, kind,
      x, y, z, vx, vy, vz,
      ttl: 5,
      gravity: opts.gravity || false,
      gravityStrength: opts.gravityStrength, // новая строка
      explosive: opts.explosive || false,
      radius: opts.radius || 0,
      dmg: opts.dmg || 0,
      scale: opts.scale || 1,
      fx: opts.fx || null,
      onHit: opts.onHit || null
    };
    projectiles.set(id, proj);
    ctx.emit('projSpawn', {
      id, kind,
      x, y, z, vx, vy, vz,
      gravity: proj.gravity,
      scale: proj.scale
    });
  }

  function placeMine(owner, x, y, z, n, len) {
    const id = nextMine++;
    mines.set(id, { id, owner, x, y, z, ttl: 60, dmg: 8 + 2 * n('dark'), radius: 2 + 0.4 * len });
    ctx.emit('mineSpawn', { id, x, y, z });
  }

  function stoneWall(x, z, yaw, len) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const half = Math.floor(Math.min(5, 1 + len) / 2);
    for (let i = -half; i <= half; i++) {
      const bx = Math.floor(x + fx * 3 + rx * i), bz = Math.floor(z + fz * 3 + rz * i);
      const y0 = ctx.terrainHeight(bx, bz);
      for (let h = 0; h < 3; h++) ctx.setBlock(bx, y0 + h, bz, 3);
    }
  }

  function pushNova(casterId, x, y, z, len) {
    ctx.emit('nova', { x, y, z });
    for (const [id, p] of ctx.getPlayers()) {
      if (id === casterId) continue;
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2;
      if (d2 < 36) ctx.applyDamage(id, 0, { ax: x, az: z, kb: 10 + 2 * len, attackerId: casterId, weapon: 'магии' });
    }
  }

  function castBeam(casterId, els, n, len, ox, oy, oz, dx, dy, dz) {
    const MAXD = 40;
    let endT = MAXD, hitId = null;
    for (let t = 1; t < MAXD; t += 0.5)
      if (ctx.getBlock(Math.floor(ox + dx * t), Math.floor(oy + dy * t), Math.floor(oz + dz * t)) !== 0) {
        endT = t; break;
      }
    for (const [pid, p] of ctx.getPlayers()) {
      if (pid === casterId) continue;
      const cx = p.x - ox, cy = p.y + 0.9 - oy, cz = p.z - oz;
      const t = cx * dx + cy * dy + cz * dz;
      if (t < 0 || t > endT) continue;
      const d2 = (cx - dx * t) ** 2 + (cy - dy * t) ** 2 + (cz - dz * t) ** 2;
      if (d2 < 0.81) { endT = t; hitId = pid; }
    }
    ctx.emit('beam', {
      x0: ox, y0: oy - 0.2, z0: oz,
      x1: ox + dx * endT, y1: oy + dy * endT, z1: oz + dz * endT,
      kind: n('light') ? 'light' : dominant(els, n),
    });
    if (hitId === null) return;
    if (n('light') && n('light') * 2 >= len) {
      ctx.clearDebuffs(hitId);
      ctx.healPlayer(hitId, 3 * n('light'));
      return;
    }
    applyElementEffects(hitId, n, casterId);
    ctx.applyDamage(hitId,
      2 + 2 * n('fire') + 2 * n('earth') + n('ice') + n('dark') + n('water'),
      { ax: ox, az: oz, kb: 4, attackerId: casterId, weapon: 'магии' });
  }

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

    // ========== 1. БАФФЫ (shield/light) ==========
    if (n('air') === 2 && n('earth') === 1 && len === 3) {
      ctx.addEffect(casterId, 'jump_boost', 75, 1.5);
      return;
    }
    if (n('water') === 1 && n('light') === 2 && len === 3) {
      ctx.addEffect(casterId, 'regen', 50, 1);
      return;
    }
    if (n('fire') === 1 && n('earth') === 1 && n('shield') === 1 && len === 3) {
      ctx.addEffect(casterId, 'fire_resist', 100, 0.5);
      return;
    }
    if (n('fire') === 2 && n('air') === 1 && len === 3) {
      ctx.addEffect(casterId, 'fire_aura', 60, { power: 1, radius: 3 });
      return;
    }
    if (n('ice') === 2 && n('earth') === 1 && len === 3) {
      ctx.addEffect(casterId, 'ice_skin', 75, 2);
      return;
    }
    if (n('beam') === 1 && n('fire') === 1 && n('air') === 1 && len === 3) {
      ctx.addEffect(casterId, 'chain_lightning', 40, 0.2);
      return;
    }
    if (n('air') === 2 && n('light') === 1 && len === 3) {
      ctx.addEffect(casterId, 'weightless', 50, 1);
      return;
    }
    if (n('shield') === 1 && n('earth') === 1 && len === 2) {
      ctx.addEffect(casterId, 'ward', 75, { power: 4 });
      return;
    }
    if (n('shield') === 1 && n('ice') === 1 && len === 2) {
      ctx.addEffect(casterId, 'stoneskin', 8, 3 * len);
      return;
    }
    if (n('light') === 2 && len === 2) {
      ctx.clearDebuffs(casterId);
      ctx.healPlayer(casterId, 3 * n('light') + len);
      return;
    }
    if (n('air') === 2 && len === 2) {
      ctx.addEffect(casterId, 'speed', 3 + 2 * n('air'), 1.6);
      return;
    }
    if (n('air') === 1 && n('light') === 1 && len === 2) {
      ctx.addEffect(casterId, 'levitate', 4 + 2 * n('air'), 1);
      return;
    }

    // ========== 2. АТАКИ / ДЕБАФФЫ (dark) ==========
    if (n('light') === 1 && n('water') === 1 && n('air') === 1 && len === 3) {
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        if (Math.hypot(p.x - ox, p.z - oz) < 5) {
          ctx.addEffect(id, 'blind', 15, 1);
          ctx.emit('blindFx', { targetId: id });
        }
      }
      ctx.emit('blindCast', { origin: { x: ox, z: oz } });
      return;
    }
    if (n('dark') === 2 && n('air') === 1 && len === 3) {
      ctx.emit('shadowStepRequest', { casterId });
      return;
    }
    if (n('dark') === 1 && n('beam') === 1 && n('fire') === 1 && len === 3) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 8) { minDist = dist; nearest = id; }
      }
      if (nearest) ctx.chainPlayers(casterId, nearest, 0.5);
      return;
    }
    if (n('dark') === 1 && n('air') === 1 && n('earth') === 1 && len === 3) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 10) { minDist = dist; nearest = id; }
      }
      if (nearest) ctx.swapPositions(casterId, nearest);
      return;
    }
    if (n('shield') === 1 && n('dark') === 1 && len === 2) {
      placeMine(casterId, ox, oy - 1.4, oz, n, len);
      return;
    }
    if (n('air') === 1 && n('dark') === 1 && len === 2) {
      const dist = 8 + 3 * n('air');
      const tx = ox + dx * dist, tz = oz + dz * dist;
      const ty = Math.max(ctx.terrainHeight(Math.floor(tx), Math.floor(tz)), 1);
      ctx.teleportPlayer(casterId, tx, ty, tz);
      ctx.emit('teleportFx', { x0: ox, y0: oy - 1, z0: oz, x1: tx, y1: ty + 1, z1: tz });
      return;
    }

    // ========== 3. МОЩНЫЕ 5-ЭЛЕМЕНТНЫЕ ==========
    if (len === 5) {
      if (n('shield') === 1 && n('earth') === 1 && n('air') === 1 && n('water') === 1 && n('light') === 1) {
        ctx.createProtectionSphere(casterId, ox, oy - 1, oz, 8);
        return;
      }
      if (n('fire') === 1 && n('earth') === 1 && n('dark') === 1 && n('beam') === 1 && n('air') === 1) {
        const targetX = ox + dx * 8;
        const targetZ = oz + dz * 8;
        spawnProjectile(casterId, 'asteroid', targetX, 60, targetZ, 0, -15, 0, {
          gravity: true,
          onHit: (x, y, z) => ctx.summonAsteroid(casterId, x, z, yaw)
        });
        return;
      }
      if (n('ice') === 1 && n('water') === 1 && n('earth') === 1 && n('dark') === 1 && n('light') === 1) {
        ctx.addTimeSlowZone(casterId, ox, oz, 5, 15);
        return;
      }
      if (n('fire') === 1 && n('light') === 1 && n('air') === 1 && n('earth') === 1 && n('shield') === 1) {
        ctx.addEffect(casterId, 'phoenix', 120, 1);
        return;
      }
      if (n('earth') === 1 && n('air') === 1 && n('fire') === 1 && n('beam') === 1 && n('shield') === 1) {
        ctx.stomp(casterId, ox, oz, 4);
        return;
      }
      if (n('dark') === 1 && n('air') === 1 && n('water') === 1 && n('earth') === 1 && n('beam') === 1) {
        ctx.blackVortex(casterId, ox, oz, 8);
        return;
      }
      if (n('light') === 1 && n('beam') === 1 && n('air') === 1 && n('earth') === 1 && n('fire') === 1) {
        let nearest = null, minDist = Infinity;
        for (const [id, p] of ctx.getPlayers()) {
          if (id === casterId) continue;
          const dist = Math.hypot(p.x - ox, p.z - oz);
          if (dist < minDist && dist < 8) { minDist = dist; nearest = id; }
        }
        if (nearest) ctx.lightCage(casterId, nearest);
        return;
      }
      if (n('dark') === 1 && n('ice') === 1 && n('earth') === 1 && n('air') === 1 && n('water') === 1) {
        let nearest = null, minDist = Infinity;
        for (const [id, p] of ctx.getPlayers()) {
          if (id === casterId) continue;
          const dist = Math.hypot(p.x - ox, p.z - oz);
          if (dist < minDist && dist < 6) { minDist = dist; nearest = id; }
        }
        if (nearest) ctx.shadowShackles(casterId, nearest);
        return;
      }
      if (n('fire') === 1 && n('dark') === 1 && n('air') === 1 && n('earth') === 1 && n('ice') === 1) {
        // Начальная позиция – перед игроком (на расстоянии 1 блок, на высоте глаз)
        const startX = ox + dx * 1.5;
        const startY = oy + 0.5;
        const startZ = oz + dz * 1.5;
        // Скорость в направлении взгляда (быстрая, как у файрбола)
        const speed = 25;
        const vx = dx * speed;
        const vy = dy * speed + 5;  // небольшой подброс вверх для дуги
        const vz = dz * speed;
        
        spawnProjectile(casterId, 'meteor', startX, startY, startZ, vx, vy, vz, {
          gravity: true,
          gravityStrength: 5,        // средняя гравитация (можно настроить)
          explosive: true,
          radius: 3 + n('earth'),
          dmg: 14 + 2 * len,
          scale: 2.5
        });
        return;     
      }
    }

    // ========== 4. ТОТЕМ / МЕТЕОР ==========
    if (n('earth') === 1 && n('beam') === 1 && n('air') === 1 && (len === 3 || len === 4)) {
      const radius = len === 4 ? 7 : 5;
      const duration = len === 4 ? 45 : 30;
      spawnProjectile(casterId, 'totem', ox + dx, oy + dy, oz + dz, dx*25, dy*25, dz*25, {
        gravity: true,
        onHit: (x, y, z) => ctx.addTotem(casterId, x, z, radius, duration)
      });
      return;
    }
    if (n('beam') === 1 && n('fire') === 1 && n('earth') === 1 && len === 3) {
      const targetX = ox + dx * 10;
      const targetZ = oz + dz * 10;
      spawnProjectile(casterId, 'meteor', targetX, 50, targetZ, 0, -20, 0, {
        gravity: true,
        explosive: true,
        radius: 5 + n('earth'),
        dmg: 14 + 2 * len,
        scale: 2.5
      });
      spawnProjectile(casterId, 'meteor', targetX, 150, targetZ+10, 0, -20, 0, {
        gravity: true,
        explosive: true,
        radius: 5 + n('earth'),
        dmg: 14 + 2 * len,
        scale: 2.5
      });
      spawnProjectile(casterId, 'meteor', targetX-15, 100, targetZ-10, 0, -20, 0, {
        gravity: true,
        explosive: true,
        radius: 5 + n('earth'),
        dmg: 14 + 2 * len,
        scale: 2.5
      });
      spawnProjectile(casterId, 'meteor', targetX-15, 130, targetZ-10, 0, -20, 0, {
        gravity: true,
        explosive: true,
        radius: 5 + n('earth'),
        dmg: 14 + 2 * len,
        scale: 2.5
      });
      return;
    }

    // ========== 5. ЛУЧ (beam) – добавлено! ==========
    if (n('beam')) {
      return castBeam(casterId, els, n, len, ox, oy, oz, dx, dy, dz);
    }

    // ========== 6. ОБЫЧНЫЙ СНАРЯД (по умолчанию) ==========
    const explosive = n('fire') > 0 && n('earth') > 0;
    const sp = 18 * (1 + 0.25 * n('air'));
    const vx = dx * sp, vy = dy * sp, vz = dz * sp;
    let radius = 0;
    if (explosive) radius = 1.5 + 0.6 * (n('fire') + n('earth'));
    let dmg = 3 * n('fire') + 4 * n('earth') + 2 * n('ice') + 2 * n('dark') + n('water') + n('air') + 2 * n('light');
    if (n('dark') === 0 && dmg > 0) dmg = Math.max(1, Math.floor(dmg / 2));
    spawnProjectile(casterId, dominant(els, n), ox + dx, oy + dy, oz + dz, vx, vy, vz, {
      gravity: n('earth') > 0,
      explosive,
      radius,
      dmg,
      fx: { n, kb: 6 + 3 * n('water') + 2 * n('air') }
    });
  }

  function tick(dt) {
    for (const [id, pr] of projectiles) {
      pr.ttl -= dt;
      if (pr.gravity) pr.vy -= (pr.gravityStrength || 20) * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.z += pr.vz * dt;

      let hitPlayer = null;
      for (const [pid, p] of ctx.getPlayers()) {
        if (pid === pr.owner) continue;
        const dx = p.x - pr.x, dy = p.y + 0.9 - pr.y, dz = p.z - pr.z;
        if (dx*dx + dy*dy + dz*dz < 1.5) { hitPlayer = pid; break; }
      }
      const hitBlock = ctx.getBlock(Math.floor(pr.x), Math.floor(pr.y), Math.floor(pr.z)) !== 0;
      if (pr.ttl <= 0 || hitPlayer !== null || hitBlock || pr.y < 0) {
        projectiles.delete(id);
        ctx.emit('projEnd', { id, x: pr.x, y: pr.y, z: pr.z });
        if (pr.explosive) {
        explode(pr.x, pr.y, pr.z, pr.radius, pr.dmg, pr.owner);
        if (pr.onHit) pr.onHit(pr.x, pr.y, pr.z);
      } else if (hitPlayer !== null) {
        if (pr.fx?.n) applyElementEffects(hitPlayer, pr.fx.n, pr.owner);
        ctx.applyDamage(hitPlayer, pr.dmg, {
          ax: pr.x - pr.vx, az: pr.z - pr.vz,
          kb: pr.fx?.kb ?? 6,
          attackerId: pr.owner,
          weapon: 'магии'
        });
      } else if (pr.onHit) {
        pr.onHit(pr.x, pr.y, pr.z);
      }
      }
    }
    for (const [id, m] of mines) {
      m.ttl -= dt;
      let trigger = m.ttl <= 0;
      if (!trigger) {
        for (const [pid, p] of ctx.getPlayers()) {
          if (pid === m.owner) continue;
          const dx = p.x - m.x, dy = p.y + 0.9 - m.y, dz = p.z - m.z;
          if (dx*dx + dy*dy + dz*dz < 1.7) { trigger = true; break; }
        }
      }
      if (trigger) {
        mines.delete(id);
        ctx.emit('mineEnd', { id });
        if (m.ttl > 0) explode(m.x, m.y, m.z, m.radius, m.dmg, m.owner);
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
      mines: [...mines.values()].map(m => ({ id: m.id, x: m.x, y: m.y, z: m.z })),
    };
  }

  return { cast, tick, validate, getSnapshot };
}