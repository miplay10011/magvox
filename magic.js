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

  function cast(casterId, els, dirArr, origin, yaw, hand = 'left') {
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

  // ========== НОВЫЕ 2-ЭЛЕМЕНТНЫЕ КОМБИНАЦИИ (атака ЛКМ / защита ПКМ) ==========
  
  // --- Огонь + Вода (конфликт, но мы убрали запрет) ---
  if (n('fire') === 1 && n('water') === 1 && len === 2) {
    if (hand === 'left') {
      // Паровая волна – отбрасывание + слабый урон
      pushNova(casterId, ox, oy, oz, 2);
      for (const [id, p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 4)
          ctx.applyDamage(id, 4, { ax: ox, az: oz, kb: 6, attackerId: casterId, weapon: 'пара' });
    } else {
      // Очищающий пар – снимает горение и заморозку
      ctx.clearDebuffs(casterId);
      ctx.addEffect(casterId, 'regen', 5, 1);
    }
    return;
  }
  
  // --- Огонь + Земля (уже есть взрывной снаряд, добавим альтернативы) ---
  if (n('fire') === 1 && n('earth') === 1 && len === 2) {
    if (hand === 'left') {
      // Обычный взрывной снаряд (как в старом коде)
      const sp = 18;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'fireball', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: true, explosive: true, radius: 2, dmg: 8,
        fx: { n, kb: 5 }
      });
    } else {
      // Каменная кожа + небольшое лечение
      ctx.addEffect(casterId, 'stoneskin', 8, 2);
      ctx.healPlayer(casterId, 4);
    }
    return;
  }
  
  // --- Вода + Воздух ---
  if (n('water') === 1 && n('air') === 1 && len === 2) {
    if (hand === 'left') {
      // Водяной разрез – снаряд с замедлением
      const sp = 22;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'water_cutter', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: false, dmg: 6,
        onHit: (x,y,z) => {
          for (const [id,p] of ctx.getPlayers())
            if (id !== casterId && Math.hypot(p.x-x, p.z-z) < 1.5)
              ctx.addEffect(id, 'slow', 3, 1);
        }
      });
    } else {
      // Воздушный карман – левитация + ускорение
      ctx.addEffect(casterId, 'levitate', 5, 1);
      ctx.addEffect(casterId, 'speed', 5, 1.3);
    }
    return;
  }
  
  // --- Земля + Воздух ---
  if (n('earth') === 1 && n('air') === 1 && len === 2) {
    if (hand === 'left') {
      // Каменный шквал – снаряд с гравитацией + небольшой взрыв
      const sp = 20;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'rock', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: true, explosive: true, radius: 1.5, dmg: 7
      });
    } else {
      // Земляная стена (маленькая) – 3 блока в ширину
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      for (let i = -1; i <= 1; i++) {
        const bx = Math.floor(ox + fx*2 + rx*i), bz = Math.floor(oz + fz*2 + rz*i);
        const y0 = ctx.terrainHeight(bx, bz);
        for (let h = 0; h < 2; h++) ctx.setBlock(bx, y0+h, bz, 3);
      }
    }
    return;
  }
  
  // --- Лёд + Огонь ---
  if (n('ice') === 1 && n('fire') === 1 && len === 2) {
    if (hand === 'left') {
      // Снаряд «пар» – накладывает и горение, и замедление
      const sp = 20;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'steam', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: true, dmg: 5,
        onHit: (id) => {
          ctx.addEffect(id, 'burning', 3, 1);
          ctx.addEffect(id, 'slow', 3, 1);
        }
      });
    } else {
      // Терморегуляция – снимает огонь и лёд, даёт небольшой щит
      if (ctx.getPlayer(casterId).effects.has('burning')) ctx.addEffect(casterId, 'fire_resist', 3, 0.5);
      if (ctx.getPlayer(casterId).effects.has('freeze')) ctx.addEffect(casterId, 'ice_skin', 3, 1);
      ctx.addEffect(casterId, 'ward', 10, { power: 3 });
    }
    return;
  }
  
  // --- Свет + Тьма ---
  if (n('light') === 1 && n('dark') === 1 && len === 2) {
    if (hand === 'left') {
      // Хаотический снаряд – случайный эффект (огонь/лёд/тьма/свет)
      const sp = 20;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'chaos', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: true, dmg: 6,
        onHit: (id) => {
          const r = Math.floor(Math.random() * 4);
          if (r === 0) ctx.addEffect(id, 'burning', 4, 1);
          else if (r === 1) ctx.addEffect(id, 'freeze', 2, 1);
          else if (r === 2) ctx.addEffect(id, 'curse', 6, 1);
          else ctx.addEffect(id, 'blind', 4, 1);
        }
      });
    } else {
      // Равновесие – исцеление + небольшой барьер
      ctx.healPlayer(casterId, 6);
      ctx.addEffect(casterId, 'ward', 8, { power: 2 });
    }
    return;
  }
  
  // --- Щит + Вода ---
  if (n('shield') === 1 && n('water') === 1 && len === 2) {
    if (hand === 'left') {
      // Водяная мина (ставит на земле, взрывается при приближении)
      placeMine(casterId, ox, oy-1.4, oz, n, len);
    } else {
      // Водный щит – регенерация + резист к огню
      ctx.addEffect(casterId, 'regen', 8, 1);
      ctx.addEffect(casterId, 'fire_resist', 8, 0.3);
    }
    return;
  }
  
  // --- Щит + Воздух ---
  if (n('shield') === 1 && n('air') === 1 && len === 2) {
    if (hand === 'left') {
      // Воздушный толчок (отбрасывание без урона)
      pushNova(casterId, ox, oy, oz, 2);
    } else {
      // Щит ветра – ускорение + уворот (малый щит)
      ctx.addEffect(casterId, 'speed', 6, 1.4);
      ctx.addEffect(casterId, 'ward', 6, { power: 2 });
    }
    return;
  }
  
  // --- Щит + Свет ---
  if (n('shield') === 1 && n('light') === 1 && len === 2) {
    if (hand === 'left') {
      // Световой клинок – снаряд, лечит кастера при попадании
      const sp = 22;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'holy_bolt', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: false, dmg: 5,
        onHit: (id) => { ctx.healPlayer(casterId, 3); }
      });
    } else {
      // Священный щит – сильный барьер и снятие проклятий
      ctx.clearDebuffs(casterId);
      ctx.addEffect(casterId, 'ward', 12, { power: 6 });
    }
    return;
  }
  
  // --- Щит + Тьма --- (уже есть мина на ЛКМ, добавим ПКМ)
  if (n('shield') === 1 && n('dark') === 1 && len === 2) {
    if (hand === 'left') placeMine(casterId, ox, oy-1.4, oz, n, len);
    else {
      // Теневой плащ – невидимость (имитируем ослеплением врагов и ускорением)
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 5)
          ctx.addEffect(id, 'blind', 4, 1);
      ctx.addEffect(casterId, 'speed', 6, 1.5);
    }
    return;
  }
  
  // ========== НОВЫЕ 3-ЭЛЕМЕНТНЫЕ КОМБИНАЦИИ (атака/защита) ==========
  
  // --- Огонь + Вода + Воздух ---
  if (n('fire')===1 && n('water')===1 && n('air')===1 && len===3) {
    if (hand === 'left') {
      // Облако пара – зона, которая наносит урон и лечит кастера
      ctx.addZone(ox, oz, 4, 'steam_cloud', casterId, 6);
      // применим немедленный эффект
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 4)
          ctx.applyDamage(id, 3, { ax: ox, az: oz, kb: 0, attackerId: casterId, weapon: 'пар' });
      ctx.healPlayer(casterId, 5);
    } else {
      // Паровой щит – резист к огню и льду
      ctx.addEffect(casterId, 'fire_resist', 8, 0.4);
      ctx.addEffect(casterId, 'ice_skin', 8, 1);
    }
    return;
  }
  
  // --- Огонь + Земля + Тьма ---
  if (n('fire')===1 && n('earth')===1 && n('dark')===1 && len===3) {
    if (hand === 'left') {
      // Вулканическая бомба – снаряд с большим радиусом и горением
      const sp = 18;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'volcano_bomb', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: true, explosive: true, radius: 3.5, dmg: 12,
        onHit: (x,y,z) => {
          for (const [id,p] of ctx.getPlayers())
            if (id !== casterId && Math.hypot(p.x-x, p.z-z) < 4)
              ctx.addEffect(id, 'burning', 5, 1);
        }
      });
    } else {
      // Магма-броня – stoneskin + fire_aura на короткое время
      ctx.addEffect(casterId, 'stoneskin', 8, 2);
      ctx.addEffect(casterId, 'fire_aura', 8, { power: 1, radius: 2 });
    }
    return;
  }
  
  // --- Вода + Лёд + Свет ---
  if (n('water')===1 && n('ice')===1 && n('light')===1 && len===3) {
    if (hand === 'left') {
      // Ледяная стрела – замораживает цель
      const sp = 24;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'ice_arrow', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: true, dmg: 6,
        onHit: (id) => ctx.addEffect(id, 'freeze', 2, 1)
      });
    } else {
      // Светлое исцеление + снятие заморозки
      ctx.clearDebuffs(casterId);
      ctx.healPlayer(casterId, 8);
    }
    return;
  }
  
  // --- Воздух + Земля + Луч ---
  if (n('air')===1 && n('earth')===1 && n('beam')===1 && len===3) {
    if (hand === 'left') {
      // Электрический разряд – цепная молния (уже есть эффект chain_lightning? но это бафф, сделаем активную)
      let nearest = null, minDist = Infinity;
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 15 && Math.hypot(p.x-ox, p.z-oz) < minDist) {
          minDist = Math.hypot(p.x-ox, p.z-oz);
          nearest = id;
        }
      if (nearest) {
        ctx.applyDamage(nearest, 10, { ax: ox, az: oz, kb: 5, attackerId: casterId, weapon: 'электричество' });
        // поиск второго врага рядом
        for (const [id2,p2] of ctx.getPlayers())
          if (id2 !== casterId && id2 !== nearest && Math.hypot(p2.x-ctx.getPlayer(nearest).x, p2.z-ctx.getPlayer(nearest).z) < 5)
            ctx.applyDamage(id2, 6, { ax: ox, az: oz, kb: 3, attackerId: casterId, weapon: 'электричество' });
      }
    } else {
      // Заземление – резист к молнии и небольшой щит
      ctx.addEffect(casterId, 'ward', 10, { power: 3 });
      // условно: электрический урон не будет проходить? но нет такого эффекта – просто щит
    }
    return;
  }
  
  // --- Тьма + Свет + Вода ---
  if (n('dark')===1 && n('light')===1 && n('water')===1 && len===3) {
    if (hand === 'left') {
      // Чёрная вода – снаряд, накладывает проклятие и ослепление
      const sp = 20;
      const vx = dx * sp, vy = dy * sp, vz = dz * sp;
      spawnProjectile(casterId, 'dark_water', ox+dx, oy+dy, oz+dz, vx, vy, vz, {
        gravity: true, dmg: 4,
        onHit: (id) => {
          ctx.addEffect(id, 'curse', 8, 1);
          ctx.addEffect(id, 'blind', 4, 1);
        }
      });
    } else {
      // Лунная вода – лечение + снятие проклятия
      ctx.clearDebuffs(casterId);
      ctx.healPlayer(casterId, 12);
    }
    return;
  }
  
  // --- 4-ЭЛЕМЕНТНЫЕ КОМБИНАЦИИ (len === 4) – усиленные версии трёхэлементных ---
  
  // Огонь+Вода+Воздух+Земля (4 стихии)
  if (n('fire')===1 && n('water')===1 && n('air')===1 && n('earth')===1 && len===4) {
    if (hand === 'left') {
      // Шторм – массовый урон и эффекты в радиусе 6
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 6) {
          ctx.applyDamage(id, 8, { ax: ox, az: oz, kb: 4, attackerId: casterId, weapon: 'шторма' });
          ctx.addEffect(id, 'slow', 3, 1);
          ctx.addEffect(id, 'burning', 3, 1);
        }
      ctx.emit('explosion', { x: ox, y: oy, z: oz, r: 3 });
    } else {
      // Защита стихий – резист ко всем видам (огонь, лёд, молния)
      ctx.addEffect(casterId, 'fire_resist', 12, 0.6);
      ctx.addEffect(casterId, 'ice_skin', 12, 2);
      ctx.addEffect(casterId, 'ward', 12, { power: 4 });
    }
    return;
  }
  
  // Свет+Тьма+Луч+Щит (божественная защита / атака)
  if (n('light')===1 && n('dark')===1 && n('beam')===1 && n('shield')===1 && len===4) {
    if (hand === 'left') {
      // Карающий луч – сильный луч с уроном 20
      castBeam(casterId, els, n, len, ox, oy, oz, dx, dy, dz);
    } else {
      // Абсолютная защита – большой щит (12 HP) + реген
      ctx.addEffect(casterId, 'ward', 15, { power: 12 });
      ctx.addEffect(casterId, 'regen', 15, 2);
    }
    return;
  }
  
  // Огонь+Лёд+Воздух+Земля (противоположности)
  if (n('fire')===1 && n('ice')===1 && n('air')===1 && n('earth')===1 && len===4) {
    if (hand === 'left') {
      // Взрывная волна с чередованием огня и льда
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 5) {
          const dmg = 7;
          ctx.applyDamage(id, dmg, { ax: ox, az: oz, kb: 5, attackerId: casterId, weapon: 'контраста' });
          if (Math.random() < 0.5) ctx.addEffect(id, 'burning', 4, 1);
          else ctx.addEffect(id, 'freeze', 2, 1);
        }
    } else {
      // Баланс – снимает все огненные и ледяные эффекты, даёт щит
      ctx.clearDebuffs(casterId);
      ctx.addEffect(casterId, 'ward', 10, { power: 5 });
    }
    return;
  }
  
  // ========== 5-ЭЛЕМЕНТНЫЕ КОМБИНАЦИИ (уникальные) – дополняем существующие ==========
  
  // 5x одного элемента (например, 5 огня) – уже не 5 разных, но поддержим
  if (n('fire') === 5 && len === 5) {
    if (hand === 'left') {
      // Метеоритный дождь – 5 снарядов вверх, которые падают
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const offX = Math.cos(angle) * 1.5, offZ = Math.sin(angle) * 1.5;
        spawnProjectile(casterId, 'meteor', ox+offX, oy+4, oz+offZ, (dx+offX)*12, 8, (dz+offZ)*12, {
          gravity: true, gravityStrength: 10, explosive: true, radius: 2.5, dmg: 10, scale: 1.5
        });
      }
    } else {
      // Абсолютное пламя – аура 5 урона в секунду в радиусе 4
      ctx.addEffect(casterId, 'fire_aura', 15, { power: 2, radius: 4 });
    }
    return;
  }
  
  if (n('water') === 5 && len === 5) {
    if (hand === 'left') {
      // Цунами – линия воды, отбрасывает
      pushNova(casterId, ox, oy, oz, 5);
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 6)
          ctx.applyDamage(id, 12, { ax: ox, az: oz, kb: 8, attackerId: casterId, weapon: 'цунами' });
    } else {
      // Аква-щит – сильная регенерация
      ctx.addEffect(casterId, 'regen', 20, 3);
    }
    return;
  }
  
  if (n('earth') === 5 && len === 5) {
    if (hand === 'left') {
      // Землетрясение – урон + подбрасывание (stomp)
      ctx.stomp(casterId, ox, oz, 6);
    } else {
      // Непробиваемая стена – большая стена впереди
      stoneWall(ox, oz, yaw, 7);
    }
    return;
  }
  
  if (n('air') === 5 && len === 5) {
    if (hand === 'left') {
      // Ураган – отбрасывает всех далеко
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 8) {
          const angle = Math.atan2(p.z-oz, p.x-ox);
          const kb = 12;
          ctx.applyDamage(id, 8, { ax: ox, az: oz, kb: kb, attackerId: casterId, weapon: 'ураган' });
        }
    } else {
      // Полёт – левитация + ускорение
      ctx.addEffect(casterId, 'levitate', 15, 1);
      ctx.addEffect(casterId, 'speed', 15, 2);
    }
    return;
  }
  
  if (n('ice') === 5 && len === 5) {
    if (hand === 'left') {
      // Глобальное замораживание – все в радиусе 8 замораживаются
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 8)
          ctx.addEffect(id, 'freeze', 5, 1);
    } else {
      // Ледяная тюрьма – стена вокруг цели (выделить врага)
      let nearest = null;
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && (!nearest || Math.hypot(p.x-ox, p.z-oz) < Math.hypot(nearest.x-ox, nearest.z-oz)))
          nearest = id;
      if (nearest) {
        const p = ctx.getPlayer(nearest);
        stoneWall(p.x, p.z, yaw, 4);
      }
    }
    return;
  }
  
  // 5 разных элементов, но не все стандартные – дополним новыми
  // (огонь+вода+земля+воздух+свет) – природный взрыв
  if (n('fire')===1 && n('water')===1 && n('earth')===1 && n('air')===1 && n('light')===1 && len===5) {
    if (hand === 'left') {
      explode(ox, oy, oz, 5, 18, casterId);
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 6)
          ctx.addEffect(id, 'blind', 4, 1);
    } else {
      ctx.addEffect(casterId, 'phoenix', 60, 1);
      ctx.healPlayer(casterId, 15);
    }
    return;
  }
  
  // (тьма+лёд+вода+земля+луч) – тёмная зима
  if (n('dark')===1 && n('ice')===1 && n('water')===1 && n('earth')===1 && n('beam')===1 && len===5) {
    if (hand === 'left') {
      ctx.blackVortex(casterId, ox, oz, 10);
      for (const [id,p] of ctx.getPlayers())
        if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 6)
          ctx.addEffect(id, 'freeze', 3, 1);
    } else {
      ctx.addTimeSlowZone(casterId, ox, oz, 6, 12);
      ctx.healPlayer(casterId, 8);
    }
    return;
  }
  
  // (свет+огонь+воздух+луч+щит) – небесный луч
  if (n('light')===1 && n('fire')===1 && n('air')===1 && n('beam')===1 && n('shield')===1 && len===5) {
    if (hand === 'left') {
      // Сильный луч
      castBeam(casterId, els, n, len, ox, oy, oz, dx, dy, dz);
    } else {
      // Небесный щит – ward + regen + fire_resist
      ctx.addEffect(casterId, 'ward', 15, { power: 10 });
      ctx.addEffect(casterId, 'regen', 15, 2);
      ctx.addEffect(casterId, 'fire_resist', 15, 0.7);
    }
    return;
  }
  
  if (hand === 'right') {
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
  }
  
  // ========== СТАРЫЕ АТАКИ / ДЕБАФФЫ – только на ЛКМ ==========
  if (hand === 'left') {
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
  }
  
  // ========== СТАНДАРТНЫЕ 5-ЭЛЕМЕНТНЫЕ (старые) – некоторые требуют разделения ==========
  if (len === 5) {
    // Сфера защиты – очевидно защита, на ПКМ
    if (n('shield') === 1 && n('earth') === 1 && n('air') === 1 && n('water') === 1 && n('light') === 1) {
      if (hand === 'right') ctx.createProtectionSphere(casterId, ox, oy - 1, oz, 8);
      else {
        // На ЛКМ – взрывная волна
        explode(ox, oy, oz, 4, 12, casterId);
        ctx.healPlayer(casterId, 6);
      }
      return;
    }
    // Стена из камня – защита (ПКМ), атака (ЛКМ) – камнепад
    if (n('shield') === 1 && n('earth') === 4) {
      if (hand === 'right') stoneWall(ox, oz, yaw, len);
      else {
        for (let i = 0; i < 5; i++) {
          const offX = (Math.random() - 0.5) * 4;
          const offZ = (Math.random() - 0.5) * 4;
          spawnProjectile(casterId, 'rock', ox+offX, oy+4, oz+offZ, (dx+offX)*10, -10, (dz+offZ)*10, {
            gravity: true, explosive: true, radius: 2, dmg: 8
          });
        }
      }
      return;
    }
    // Остальные старые 5-элементные – они уже атакующие или защитные? Оставим их без разделения? 
    // Для единообразия добавим проверку: большинство атакующих – на ЛКМ, защитные – на ПКМ.
    // Астероид – атака (ЛКМ)
    if (n('fire') === 1 && n('earth') === 1 && n('dark') === 1 && n('beam') === 1 && n('air') === 1) {
      if (hand === 'left') {
        const targetX = ox + dx * 8;
        const targetZ = oz + dz * 8;
        spawnProjectile(casterId, 'asteroid', targetX, 60, targetZ, 0, -15, 0, {
          gravity: true,
          onHit: (x, y, z) => ctx.summonAsteroid(casterId, x, z, yaw)
        });
      } else {
        ctx.addEffect(casterId, 'ward', 15, { power: 10 });
      }
      return;
    }
    // Зона замедления времени – защита/контроль (на ПКМ)
    if (n('ice') === 1 && n('water') === 1 && n('earth') === 1 && n('dark') === 1 && n('light') === 1) {
      if (hand === 'right') ctx.addTimeSlowZone(casterId, ox, oz, 5, 15);
      else {
        // Атака: ледяной взрыв
        explode(ox, oy, oz, 3, 10, casterId);
        for (const [id,p] of ctx.getPlayers())
          if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 4)
            ctx.addEffect(id, 'freeze', 3, 1);
      }
      return;
    }
    // Феникс – защита (ПКМ)
    if (n('fire') === 1 && n('light') === 1 && n('air') === 1 && n('earth') === 1 && n('shield') === 1) {
      if (hand === 'right') ctx.addEffect(casterId, 'phoenix', 120, 1);
      else {
        // Атака: огненный шторм
        for (const [id,p] of ctx.getPlayers())
          if (id !== casterId && Math.hypot(p.x-ox, p.z-oz) < 5)
            ctx.addEffect(id, 'burning', 6, 1);
        explode(ox, oy, oz, 3, 8, casterId);
      }
      return;
    }
    // Топот – атака (ЛКМ), защита (ПКМ) – каменная стена
    if (n('earth') === 1 && n('air') === 1 && n('fire') === 1 && n('beam') === 1 && n('shield') === 1) {
      if (hand === 'left') ctx.stomp(casterId, ox, oz, 4);
      else stoneWall(ox, oz, yaw, 3);
      return;
    }
    // Чёрный вихрь – атака (ЛКМ), защита (ПКМ) – тёмный щит
    if (n('dark') === 1 && n('air') === 1 && n('water') === 1 && n('earth') === 1 && n('beam') === 1) {
      if (hand === 'left') ctx.blackVortex(casterId, ox, oz, 8);
      else ctx.addEffect(casterId, 'ward', 12, { power: 8 });
      return;
    }
    // Световая клетка – атака (ЛКМ), защита (ПКМ) – щит союзнику
    if (n('light') === 1 && n('beam') === 1 && n('air') === 1 && n('earth') === 1 && n('fire') === 1) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 8) { minDist = dist; nearest = id; }
      }
      if (nearest) {
        if (hand === 'left') ctx.lightCage(casterId, nearest);
        else ctx.addEffect(nearest, 'ward', 10, { power: 6 });
      }
      return;
    }
    // Теневые оковы – атака (ЛКМ), защита (ПКМ) – теневая вуаль
    if (n('dark') === 1 && n('ice') === 1 && n('earth') === 1 && n('air') === 1 && n('water') === 1) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 6) { minDist = dist; nearest = id; }
      }
      if (nearest) {
        if (hand === 'left') ctx.shadowShackles(casterId, nearest);
        else ctx.addEffect(casterId, 'speed', 10, 1.5);
      }
      return;
    }
    // Метеор (дыхание дракона) – атака (ЛКМ), защита (ПКМ) – драконья чешуя
    if (n('fire') === 1 && n('dark') === 1 && n('air') === 1 && n('earth') === 1 && n('ice') === 1) {
      const startX = ox + dx * 1.5;
      const startY = oy + 0.5;
      const startZ = oz + dz * 1.5;
      const speed = 25;
      const vx = dx * speed;
      const vy = dy * speed + 5;
      const vz = dz * speed;
      if (hand === 'left') {
        spawnProjectile(casterId, 'meteor', startX, startY, startZ, vx, vy, vz, {
          gravity: true, gravityStrength: 5, explosive: true, radius: 3 + n('earth'),
          dmg: 14 + 2 * len, scale: 2.5
        });
      } else {
        ctx.addEffect(casterId, 'fire_resist', 20, 0.6);
        ctx.addEffect(casterId, 'stoneskin', 20, 3);
      }
      return;
    }
  }

  // ========== 4. ТОТЕМ / МЕТЕОР (старые) ==========
  if (n('earth') === 1 && n('beam') === 1 && n('air') === 1 && (len === 3 || len === 4)) {
    if (hand === 'left') {
      const radius = len === 4 ? 7 : 5;
      const duration = len === 4 ? 45 : 30;
      spawnProjectile(casterId, 'totem', ox + dx, oy + dy, oz + dz, dx*25, dy*25, dz*25, {
        gravity: true,
        onHit: (x, y, z) => ctx.addTotem(casterId, x, z, radius, duration)
      });
    } else {
      // Мгновенный тотем на месте (защита)
      const radius = len === 4 ? 5 : 3;
      const duration = len === 4 ? 30 : 20;
      ctx.addTotem(casterId, ox, oz, radius, duration);
    }
    return;
  }
  if (n('beam') === 1 && n('fire') === 1 && n('earth') === 1 && len === 3) {
    if (hand === 'left') {
      const targetX = ox + dx * 10;
      const targetZ = oz + dz * 10;
      spawnProjectile(casterId, 'meteor', targetX, 50, targetZ, 0, -20, 0, {
        gravity: true, explosive: true, radius: 2 + n('earth'), dmg: 14 + 2 * len, scale: 2.5
      });
    } else {
      ctx.addEffect(casterId, 'ward', 15, { power: 6 });
    }
    return;
  }

  // ========== 5. ЛУЧ (beam) – с поддержкой рук ==========
  if (n('beam')) {
    if (hand === 'left') {
      return castBeam(casterId, els, n, len, ox, oy, oz, dx, dy, dz);
    } else {
      // ПКМ: лечебный луч
      const MAXD = 25;
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
        if (d2 < 0.81) { endT = t; hitId = pid; break; }
      }
      ctx.emit('beam', {
        x0: ox, y0: oy - 0.2, z0: oz,
        x1: ox + dx * endT, y1: oy + dy * endT, z1: oz + dz * endT,
        kind: 'light'
      });
      if (hitId !== null) {
        ctx.healPlayer(hitId, 8);
        ctx.clearDebuffs(hitId);
      } else {
        ctx.healPlayer(casterId, 4);
      }
      return;
    }
  }

  // ========== 6. ОБЫЧНЫЙ СНАРЯД (по умолчанию) – с поддержкой рук ==========
  const explosive = n('fire') > 0 && n('earth') > 0;
  const sp = 18 * (1 + 0.25 * n('air'));
  const vx = dx * sp, vy = dy * sp, vz = dz * sp;
  let radius = 0;
  if (explosive) radius = 1.5 + 0.6 * (n('fire') + n('earth'));
  let dmg = 3 * n('fire') + 4 * n('earth') + 2 * n('ice') + 2 * n('dark') + n('water') + n('air') + 2 * n('light');
  if (n('dark') === 0 && dmg > 0) dmg = Math.max(1, Math.floor(dmg / 2));
  if (hand === 'left') {
    spawnProjectile(casterId, dominant(els, n), ox + dx, oy + dy, oz + dz, vx, vy, vz, {
      gravity: n('earth') > 0,
      explosive,
      radius,
      dmg,
      fx: { n, kb: 6 + 3 * n('water') + 2 * n('air') }
    });
  } else {
    // ПКМ: защита вместо снаряда
    const shieldPower = Math.max(2, Math.floor(dmg / 4));
    ctx.addEffect(casterId, 'ward', 10, { power: shieldPower });
    if (dmg > 8) ctx.healPlayer(casterId, Math.floor(dmg / 3));
    else ctx.addEffect(casterId, 'stoneskin', 6, 2);
  }
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