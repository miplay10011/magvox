// Общий движок заклинаний: работает и в Node (сервер), и в браузере (оффлайн).
export const SPELL_ELEMENTS = ['fire','water','air','earth','beam','ice','shield','light','dark'];
// Убираем конфликт light-dark, оставляем только fire-water и fire-ice
export const CONFLICTS = [['fire','water'],['fire','ice']];
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
    for (const [a, b] of CONFLICTS)
      if (els.includes(a) && els.includes(b)) return false;
    return true;
  }

  function explode(x, y, z, radius, dmg, ownerId) {
    radius = Math.min(radius, 4.5);
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
      if (d2 < rr * rr)
        ctx.applyDamage(id, dmg * (1 - Math.sqrt(d2) / rr), {
          ax: x, az: z, kb: 8 + radius * 2,
          attackerId: ownerId,
          weapon: 'магии'
        });
    }
  }

  function applyElementEffects(targetId, n, attackerId) {
    if (n('fire')) ctx.addEffect(targetId, 'burning', 3, n('fire'));
    if (n('ice'))  ctx.addEffect(targetId, n('ice') >= 3 ? 'freeze' : 'slow',
                                 n('ice') >= 3 ? 1.5 : 4, n('ice'));
    if (n('dark')) ctx.addEffect(targetId, 'curse', 6 + 2 * n('dark'), n('dark'));
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

    // ========== НОВЫЕ КОМБИНАЦИИ ==========
    // Прыгучесть (air + earth) – базовый вариант
    if (n('air') === 1 && n('earth') === 1) {
      ctx.addEffect(casterId, 'jump_boost', 75, 1.3);
      return;
    }
    // Усиленная прыгучесть (air + air + earth)
    if (n('air') === 2 && n('earth') === 1) {
      ctx.addEffect(casterId, 'jump_boost', 120, 2);
      return;
    }

    // Регенерация (water + light) – базовый
    if (n('water') === 1 && n('light') === 1) {
      ctx.addEffect(casterId, 'regen', 50, 1);
      return;
    }
    // Усиленная регенерация (water + light + light)
    if (n('water') === 1 && n('light') === 2) {
      ctx.addEffect(casterId, 'regen', 80, 2);
      return;
    }

    // Огнеупорность (fire + earth) – базовый
    if (n('fire') === 1 && n('earth') === 1) {
      ctx.addEffect(casterId, 'fire_resist', 100, 1);
      return;
    }
    // Усиленная огнеупорность (fire + earth + shield)
    if (n('fire') === 1 && n('earth') === 1 && n('shield') === 1) {
      ctx.addEffect(casterId, 'fire_resist', 150, 2);
      return;
    }

    // Огненная аура (fire + fire + air) – базовый урон 1
    if (n('fire') === 2 && n('air') === 1) {
      ctx.addEffect(casterId, 'fire_aura', 60, 1);
      return;
    }
    // Усиленная огненная аура (fire + fire + air + air) – урон 2
    if (n('fire') === 2 && n('air') === 2) {
      ctx.addEffect(casterId, 'fire_aura', 90, 2);
      return;
    }
    // Максимальная аура (fire + fire + fire + air + air) – урон 3
    if (n('fire') === 3 && n('air') === 2) {
      ctx.addEffect(casterId, 'fire_aura', 120, 3);
      return;
    }

    // Ледяная кожа (ice + earth) – базовый
    if (n('ice') === 1 && n('earth') === 1) {
      ctx.addEffect(casterId, 'ice_skin', 75, 1);
      return;
    }
    // Усиленная ледяная кожа (ice + earth + earth) – длиннее
    if (n('ice') === 1 && n('earth') === 2) {
      ctx.addEffect(casterId, 'ice_skin', 120, 1);
      return;
    }

    // Разряд (beam + fire) – базовый
    if (n('beam') === 1 && n('fire') === 1) {
      ctx.addEffect(casterId, 'chain_lightning', 40, 1);
      return;
    }
    // Усиленный разряд (beam + fire + air) – больше шанс?
    if (n('beam') === 1 && n('fire') === 1 && n('air') === 1) {
      ctx.addEffect(casterId, 'chain_lightning', 60, 2);
      return;
    }

    // Ослепление (light + dark) – базовое
    if (n('light') === 1 && n('dark') === 1) {
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < 5) ctx.addEffect(id, 'blind', 15, 1);
      }
      return;
    }
    // Усиленное ослепление (light + dark + air) – больший радиус
    if (n('light') === 1 && n('dark') === 1 && n('air') === 1) {
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < 8) ctx.addEffect(id, 'blind', 25, 1);
      }
      return;
    }

    // Теневой шаг (dark + dark) – базовый
    if (n('dark') === 2) {
      ctx.emit('shadowStepRequest', { casterId });
      return;
    }
    // Усиленный теневой шаг (dark + dark + air) – большая дальность
    if (n('dark') === 2 && n('air') === 1) {
      ctx.emit('shadowStepRequest', { casterId, range: 15 });
      return;
    }

    // Невесомость (air + light) – базовый
    if (n('air') === 1 && n('light') === 1) {
      ctx.addEffect(casterId, 'weightless', 50, 1);
      return;
    }
    // Усиленная невесомость (air + air + light) – дольше
    if (n('air') === 2 && n('light') === 1) {
      ctx.addEffect(casterId, 'weightless', 80, 1);
      return;
    }

    // Барьер (shield) – базовый (3 единицы)
    if (n('shield') === 1) {
      ctx.addEffect(casterId, 'ward', 75, { power: 3 });
      return;
    }
    // Усиленный барьер (shield + earth) – 5 единиц
    if (n('shield') === 1 && n('earth') === 1) {
      ctx.addEffect(casterId, 'ward', 100, { power: 5 });
      return;
    }

    // Цепочка послушания (dark + beam) – базовый
    if (n('dark') === 1 && n('beam') === 1) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 8) { minDist = dist; nearest = id; }
      }
      if (nearest) {
        ctx.chainPlayers(casterId, nearest);
        ctx.emit('systemMessage', { message: `Цепочка послушания связала вас с игроком ${nearest}` });
      }
      return;
    }
    // Усиленная цепочка (dark + beam + fire) – связывает и наносит дополнительный урон при связи
    if (n('dark') === 1 && n('beam') === 1 && n('fire') === 1) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 12) { minDist = dist; nearest = id; }
      }
      if (nearest) {
        ctx.chainPlayers(casterId, nearest);
        ctx.applyDamage(nearest, 4, { attackerId: casterId, weapon: 'цепочки послушания' });
        ctx.emit('systemMessage', { message: `Цепочка послушания связала вас с игроком ${nearest} и нанесла урон` });
      }
      return;
    }

    // Массовый левитирующий круг (air + water) – базовый радиус 3
    if (n('air') === 1 && n('water') === 1) {
      ctx.addZone(ox, oz, 3, 'levitate_circle', casterId, 40);
      ctx.emit('systemMessage', { message: 'Вы создали левитирующий круг!' });
      return;
    }
    // Усиленный круг (air + air + water + earth) – радиус 5
    if (n('air') === 2 && n('water') === 1 && n('earth') === 1) {
      ctx.addZone(ox, oz, 5, 'levitate_circle', casterId, 60);
      ctx.emit('systemMessage', { message: 'Вы создали усиленный левитирующий круг!' });
      return;
    }

    // Обмен местами (dark + air) – базовый радиус 8
    if (n('dark') === 1 && n('air') === 1) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 8) { minDist = dist; nearest = id; }
      }
      if (nearest) {
        ctx.swapPositions(casterId, nearest);
        ctx.emit('systemMessage', { message: 'Вы обменялись местами!' });
      }
      return;
    }
    // Усиленный обмен (dark + air + earth) – радиус 12
    if (n('dark') === 1 && n('air') === 1 && n('earth') === 1) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 12) { minDist = dist; nearest = id; }
      }
      if (nearest) {
        ctx.swapPositions(casterId, nearest);
        ctx.emit('systemMessage', { message: 'Вы обменялись местами на большом расстоянии!' });
      }
      return;
    }

    // Дополнительные комбинации: ускорение (air + air) – базовое, уже есть в старом коде
    // Но добавим усиленное ускорение (air + air + light)
    if (n('air') === 2 && n('light') === 1) {
      ctx.addEffect(casterId, 'speed', 20, 2.5);
      return;
    }

    // === СТАРЫЕ ЗАКЛИНАНИЯ (без изменений) ===
    if (n('shield')) {
      if (n('dark'))  return placeMine(casterId, ox, oy - 1.4, oz, n, len);
      if (n('earth')) return stoneWall(ox, oz, yaw, len);
      if (n('air'))   return pushNova(casterId, ox, oy - 1.6, oz, len);
      if (n('ice'))   return ctx.addEffect(casterId, 'stoneskin', 8, 3 * len);
      return ctx.addEffect(casterId, 'ward', 10, { power: 3 * len });
    }
    if (n('air') && n('dark')) {
      const dist = 8 + 3 * n('air');
      const tx = ox + dx * dist, tz = oz + dz * dist;
      const ty = Math.max(ctx.terrainHeight(Math.floor(tx), Math.floor(tz)), 1);
      ctx.teleportPlayer(casterId, tx, ty, tz);
      ctx.emit('teleportFx', { x0: ox, y0: oy - 1, z0: oz, x1: tx, y1: ty + 1, z1: tz });
      return;
    }
    if (n('air') && n('light'))
      return ctx.addEffect(casterId, 'levitate', 4 + 2 * n('air'), 1);
    if (n('beam') && n('fire') && n('earth')) {
      let t = 1;
      for (; t < 60; t += 1)
        if (ctx.getBlock(Math.floor(ox + dx * t), Math.floor(oy + dy * t), Math.floor(oz + dz * t)) !== 0) break;
      const tx = ox + dx * t, tz = oz + dz * t;
      spawnProjectile(casterId, 'meteor', tx, oy + dy * t + 30, tz, 0, -22, 0, false, {
        explosive: true, radius: 3 + 0.5 * n('earth'), dmg: 14 + 2 * len, fx: { kb: 12 },
        scale: 2.5,
      });
      return;
    }
    if (n('beam')) return castBeam(casterId, els, n, len, ox, oy, oz, dx, dy, dz);
    if (n('light') && n('light') * 2 >= len) {
      ctx.clearDebuffs(casterId);
      return ctx.healPlayer(casterId, 3 * n('light') + len);
    }
    if (n('air') && n('air') * 2 >= len)
      return ctx.addEffect(casterId, 'speed', 3 + 2 * n('air'), 1.6);

    const explosive = n('fire') > 0 && n('earth') > 0;
    const sp = 18 * (1 + 0.25 * n('air'));
    spawnProjectile(casterId, dominant(els, n),
      ox + dx, oy + dy, oz + dz, dx * sp, dy * sp, dz * sp,
      n('earth') > 0, {
        explosive,
        radius: explosive ? 1.5 + 0.6 * (n('fire') + n('earth')) : 0,
        dmg: 3 * n('fire') + 4 * n('earth') + 2 * n('ice') + 2 * n('dark') + n('water') + n('air') + 2 * n('light'),
        fx: { n, kb: 6 + 3 * n('water') + 2 * n('air') },
      });
  }

  function spawnProjectile(owner, kind, x, y, z, vx, vy, vz, gravity, opts) {
    const id = nextProj++;
    projectiles.set(id, { id, owner, kind, x, y, z, vx, vy, vz, gravity, ttl: 5, ...opts });
    ctx.emit('projSpawn', { id, kind, x, y, z, vx, vy, vz, gravity, scale: opts.scale || 1 });
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

  function tick(dt) {
    for (const [id, pr] of projectiles) {
      pr.ttl -= dt;
      if (pr.gravity || pr.kind === 'meteor') pr.vy -= (pr.kind === 'meteor' ? 10 : 20) * dt;
      pr.x += pr.vx * dt; pr.y += pr.vy * dt; pr.z += pr.vz * dt;

      let hitPlayer = null;
      for (const [pid, p] of ctx.getPlayers()) {
        if (pid === pr.owner) continue;
        const d2 = (p.x - pr.x) ** 2 + (p.y + 0.9 - pr.y) ** 2 + (p.z - pr.z) ** 2;
        if (d2 < 1) { hitPlayer = pid; break; }
      }
      const hitBlock = ctx.getBlock(Math.floor(pr.x), Math.floor(pr.y), Math.floor(pr.z)) !== 0;
      if (pr.ttl <= 0 || hitPlayer !== null || hitBlock || pr.y < 0) {
        projectiles.delete(id);
        ctx.emit('projEnd', { id, x: pr.x, y: pr.y, z: pr.z });
        if (pr.explosive) explode(pr.x, pr.y, pr.z, pr.radius, pr.dmg, pr.owner);
        else if (hitPlayer !== null) {
          if (pr.fx?.n) applyElementEffects(hitPlayer, pr.fx.n, pr.owner);
          ctx.applyDamage(hitPlayer, pr.dmg, {
            ax: pr.x - pr.vx, az: pr.z - pr.vz, kb: pr.fx?.kb ?? 6,
            attackerId: pr.owner, weapon: 'магии'
          });
        }
      }
    }
    for (const [id, m] of mines) {
      m.ttl -= dt;
      let trigger = m.ttl <= 0;
      if (!trigger)
        for (const [pid, p] of ctx.getPlayers()) {
          if (pid === m.owner) continue;
          if ((p.x - m.x) ** 2 + (p.y + 0.9 - m.y) ** 2 + (p.z - m.z) ** 2 < 1.7) { trigger = true; break; }
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
        vx: p.vx, vy: p.vy, vz: p.vz, gravity: p.gravity, scale: p.scale || 1,
      })),
      mines: [...mines.values()].map(m => ({ id: m.id, x: m.x, y: m.y, z: m.z })),
    };
  }

  return { cast, tick, validate, getSnapshot };
}