// magic.js – полный движок заклинаний с новыми способностями
export const SPELL_ELEMENTS = ['fire','water','air','earth','beam','ice','shield','light','dark'];
export const CONFLICTS = [['fire','water'],['fire','ice'],['light','dark']];
export const MANA_PER_ELEMENT = 1, CAST_COOLDOWN = 500;

export function createMagicEngine(ctx) {
  const projectiles = new Map(), mines = new Map(), lastCast = new Map();
  let nextProj = 1, nextMine = 1;

  // ========== Утилиты ==========
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

  // ========== Взрыв (для снарядов и мин) ==========
  function explode(x, y, z, radius, dmg, ownerId, extraEffect = null) {
    radius = Math.min(radius, 5.5);
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
        const dmgActual = dmg * (1 - Math.sqrt(d2) / rr);
        ctx.applyDamage(id, dmgActual, {
          ax: x, az: z, kb: 8 + radius * 2,
          attackerId: ownerId,
          weapon: 'магии'
        });
        if (extraEffect) extraEffect(id);
      }
    }
  }

  // Применение дебаффов (для хаотического взрыва)
  function applyRandomDebuffs(targetId) {
    const debuffs = ['burning','freeze','blind','weakness','vulnerability'];
    const selected = [];
    while (selected.length < 5 && debuffs.length) {
      const idx = Math.floor(Math.random() * debuffs.length);
      if (!selected.includes(debuffs[idx])) selected.push(debuffs[idx]);
    }
    for (const d of selected) {
      if (d === 'burning') ctx.addEffect(targetId, 'burning', 6, 2);
      else if (d === 'freeze') ctx.addEffect(targetId, 'freeze', 3, 1);
      else if (d === 'blind') ctx.addEffect(targetId, 'blind', 5, 1);
      else if (d === 'weakness') ctx.addEffect(targetId, 'weakness', 8, 0.5); // урон -50%
      else if (d === 'vulnerability') ctx.addEffect(targetId, 'vulnerability', 8, 1.5); // получает +50% урона
    }
  }

  // ========== Специфические заклинания ==========
  // Сфера абсолютной защиты
  function createProtectionSphere(casterId, x, y, z, duration = 8) {
    ctx.emit('sphereSpawn', { casterId, x, y, z, radius: 3, duration });
    const sphereId = Math.random();
    const endTime = Date.now() + duration * 1000;
    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(interval);
        ctx.emit('sphereEnd', { casterId });
        return;
      }
      // Лечение всех внутри сферы (включая создателя)
      for (const [id, p] of ctx.getPlayers()) {
        if (Math.hypot(p.x - x, p.z - z) < 3 && p.y > y - 1 && p.y < y + 2) {
          ctx.healPlayer(id, 2);
        }
      }
    }, 1000);
    // Отражаем 50% урона (делаем через специальный флаг, который проверим в applyDamage на сервере)
    ctx.emit('sphereActive', { casterId, reflect: 0.5 });
  }

  // Астероид
  function summonAsteroid(casterId, targetX, targetZ, yaw) {
    const impactX = targetX + Math.sin(yaw) * 3;
    const impactZ = targetZ + Math.cos(yaw) * 3;
    const startY = 60;
    ctx.emit('asteroidStart', { casterId, x: impactX, z: impactZ, startY });
    // Через 1.5 секунды удар
    setTimeout(() => {
      const radius = 5;
      const dmg = 18;
      explode(impactX, 0, impactZ, radius, dmg, casterId, (id) => {
        ctx.addEffect(id, 'disorient', 6, 1); // дезориентация (перевернутый экран)
      });
      // Создание воронки из камня
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const dist = Math.hypot(dx, dz);
          if (dist < radius) {
            const bx = Math.floor(impactX + dx);
            const bz = Math.floor(impactZ + dz);
            const y = ctx.terrainHeight(bx, bz);
            for (let h = 0; h < Math.max(1, radius - Math.floor(dist)); h++) {
              ctx.setBlock(bx, y + h, bz, 3); // камень
            }
          }
        }
      }
      ctx.emit('asteroidImpact', { x: impactX, z: impactZ, radius });
    }, 1500);
  }

  // Вечный лёд разума (сфера замедления времени)
  let timeSlowZones = new Map();
  function createTimeSlowZone(casterId, x, z, radius = 5, duration = 15) {
    const zoneId = Math.random();
    timeSlowZones.set(zoneId, { x, z, radius, endTime: Date.now() + duration * 1000, casterId });
    ctx.emit('timeSlowZone', { zoneId, x, z, radius, duration });
    setTimeout(() => timeSlowZones.delete(zoneId), duration * 1000);
    // Эффект замедления: в tick будет применяться к игрокам и снарядам
  }

  // Феникс-возрождение (пассивный эффект, активируется при HP < 4)
  // Реализуется через отдельную проверку на сервере, здесь только установка баффа
  function applyPhoenix(casterId) {
    ctx.addEffect(casterId, 'phoenix', 120, 1); // длится 2 минуты, но срабатывает один раз
    // При срабатывании сервер вызовет эффект
  }

  // Громокаменный топот
  function stomp(casterId, x, z, yaw) {
    const radius = 4;
    ctx.emit('stompFx', { x, z, radius });
    for (const [id, p] of ctx.getPlayers()) {
      if (id === casterId) continue;
      const dist = Math.hypot(p.x - x, p.z - z);
      if (dist < radius) {
        // подбрасывание вверх
        ctx.teleportPlayer(id, p.x, p.y + 3, p.z);
        ctx.applyDamage(id, 8, { ax: x, az: z, kb: 12, attackerId: casterId, weapon: 'топота' });
        ctx.addEffect(id, 'disarm', 5, 1); // разрядка оружия
      }
    }
  }

  // Чёрный вихрь
  function blackVortex(casterId, x, z, yaw) {
    const vortexId = Math.random();
    const duration = 8;
    ctx.emit('vortexSpawn', { vortexId, x, z, radius: 4, duration });
    // Затягивание предметов и стрел – абстрактно, но можно собирать снаряды в точке
    const endTime = Date.now() + duration * 1000;
    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(interval);
        ctx.emit('vortexEnd', { vortexId });
        return;
      }
      // Выпускаем во врагов накопленные снаряды (упрощённо – просто урон в радиусе)
      for (const [id, p] of ctx.getPlayers()) {
        if (id !== casterId && Math.hypot(p.x - x, p.z - z) < 6) {
          ctx.applyDamage(id, 6, { ax: x, az: z, kb: 5, attackerId: casterId, weapon: 'чёрного вихря' });
        }
      }
    }, 1000);
  }

  // Световая клетка
  function lightCage(casterId, targetId) {
    ctx.emit('cageSpawn', { casterId, targetId });
    const duration = 6;
    const endTime = Date.now() + duration * 1000;
    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(interval);
        ctx.emit('cageEnd', { targetId });
        return;
      }
      ctx.applyDamage(targetId, 4, { ax: 0, az: 0, kb: 0, attackerId: casterId, weapon: 'световой клетки' });
    }, 1000);
  }

  // Теневые оковы
  function shadowShackles(casterId, targetId) {
    ctx.addEffect(targetId, 'shadow_shackles', 6, 1);
    ctx.emit('shacklesFx', { targetId });
  }

  // ========== Дыхание дракона и тотем (уже были) ==========
  function dragonBreath(casterId, origin, dir, yaw) {
    const coneAngle = Math.PI / 3;
    const maxDist = 8;
    const damage = 8;
    const knockback = 10;
    for (const [id, p] of ctx.getPlayers()) {
      if (id === casterId) continue;
      const toTarget = { x: p.x - origin.x, z: p.z - origin.z };
      const dist = Math.hypot(toTarget.x, toTarget.z);
      if (dist > maxDist) continue;
      const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const dot = (toTarget.x * forward.x + toTarget.z * forward.z) / dist;
      if (dot >= Math.cos(coneAngle)) {
        ctx.applyDamage(id, damage, { ax: origin.x, az: origin.z, kb: knockback, attackerId: casterId, weapon: 'дыхания дракона' });
        ctx.addEffect(id, 'burning', 4, 1);
        ctx.addEffect(id, 'freeze', 2, 1);
        ctx.addEffect(id, 'weakness', 5, 0.7);
        ctx.emit('dragonBreathFx', { from: origin, to: p });
      }
    }
    ctx.emit('dragonBreathCone', { origin, dir, yaw });
  }

  function spawnTotem(casterId, x, z, duration = 30, radius = 5) {
    const id = Math.random();
    ctx.emit('totemSpawn', { id, x, z, radius, duration });
    let lastTick = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - lastTick >= 3000) {
        lastTick = now;
        const playersInRange = [...ctx.getPlayers()].filter(([pid, p]) => pid !== casterId && Math.hypot(p.x - x, p.z - z) < radius);
        if (playersInRange.length) {
          const randomTarget = playersInRange[Math.floor(Math.random() * playersInRange.length)];
          const targetId = randomTarget[0];
          ctx.addEffect(targetId, 'speed', 5, 1.5);
          ctx.emit('totemCharge', { targetId, casterId });
          // зарядка оружия: следующий урон +6
          ctx.emit('totemPower', { targetId, power: 6 });
        }
      }
    }, 3000);
    setTimeout(() => {
      clearInterval(interval);
      ctx.emit('totemEnd', { id });
    }, duration * 1000);
  }

  // ========== Основной cast ==========
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

    // ---------- НОВЫЕ МОЩНЫЕ ЗАКЛИНАНИЯ (требуют 5 элементов) ----------
    // Хаотический взрыв (fire+water+air+earth+dark)
    if (n('fire') === 1 && n('water') === 1 && n('air') === 1 && n('earth') === 1 && n('dark') === 1) {
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      const speed = 30;
      const projId = nextProj++;
      const startX = ox + dx, startY = oy + dy, startZ = oz + dz;
      const vx = dx * speed, vy = dy * speed, vz = dz * speed;
      const projectile = { id: projId, owner: casterId, kind: 'chaos', x: startX, y: startY, z: startZ, vx, vy, vz, gravity: false, ttl: 3 };
      projectiles.set(projId, projectile);
      ctx.emit('projSpawn', { id: projId, kind: 'chaos', x: startX, y: startY, z: startZ, vx, vy, vz, gravity: false, scale: 1.2 });
      const checkInterval = setInterval(() => {
        const p = projectiles.get(projId);
        if (!p) { clearInterval(checkInterval); return; }
        for (const [id, player] of ctx.getPlayers()) {
          if (id === casterId) continue;
          const d2 = (player.x - p.x)**2 + (player.y + 0.9 - p.y)**2 + (player.z - p.z)**2;
          if (d2 < 1.5) {
            projectiles.delete(projId);
            clearInterval(checkInterval);
            explode(p.x, p.y, p.z, 4, 12, casterId, (target) => applyRandomDebuffs(target));
            ctx.emit('projEnd', { id: projId, x: p.x, y: p.y, z: p.z });
            return;
          }
        }
      }, 50);
      return;
    }

    // Сфера абсолютной защиты (shield+earth+air+water+light)
    if (n('shield') === 1 && n('earth') === 1 && n('air') === 1 && n('water') === 1 && n('light') === 1) {
      createProtectionSphere(casterId, ox, oy - 1, oz, 8);
      return;
    }

    // Астероид (fire+earth+dark+beam+air)
    if (n('fire') === 1 && n('earth') === 1 && n('dark') === 1 && n('beam') === 1 && n('air') === 1) {
      summonAsteroid(casterId, ox, oz, yaw);
      return;
    }

    // Вечный лёд разума (ice+water+earth+dark+light) – несмотря на dark+light конфликт? Это исключение, разрешим
    if (n('ice') === 1 && n('water') === 1 && n('earth') === 1 && n('dark') === 1 && n('light') === 1) {
      createTimeSlowZone(casterId, ox, oz, 5, 15);
      return;
    }

    // Феникс-возрождение (fire+light+air+earth+shield)
    if (n('fire') === 1 && n('light') === 1 && n('air') === 1 && n('earth') === 1 && n('shield') === 1) {
      applyPhoenix(casterId);
      return;
    }

    // Громокаменный топот (earth+air+fire+beam+shield) – 5 элементов
    if (n('earth') === 1 && n('air') === 1 && n('fire') === 1 && n('beam') === 1 && n('shield') === 1) {
      stomp(casterId, ox, oz, yaw);
      return;
    }

    // Чёрный вихрь (dark+air+water+earth+beam)
    if (n('dark') === 1 && n('air') === 1 && n('water') === 1 && n('earth') === 1 && n('beam') === 1) {
      blackVortex(casterId, ox, oz, yaw);
      return;
    }

    // Световая клетка (light+beam+air+earth+fire) – 5 элементов
    if (n('light') === 1 && n('beam') === 1 && n('air') === 1 && n('earth') === 1 && n('fire') === 1) {
      // выбираем ближайшего врага
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 8) { minDist = dist; nearest = id; }
      }
      if (nearest) lightCage(casterId, nearest);
      return;
    }

    // Теневые оковы (dark+ice+earth+air+water) – 5 элементов
    if (n('dark') === 1 && n('ice') === 1 && n('earth') === 1 && n('air') === 1 && n('water') === 1) {
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 6) { minDist = dist; nearest = id; }
      }
      if (nearest) shadowShackles(casterId, nearest);
      return;
    }

    // Дыхание дракона (5 элементов, ранее добавленное)
    if (n('fire') === 1 && n('water') === 1 && n('air') === 1 && n('earth') === 1 && n('ice') === 1) {
      dragonBreath(casterId, { x: ox, z: oz }, { x: dx, z: dz }, yaw);
      return;
    }

    // Электрический тотем (earth+beam+air) – 3 элемента
    if (n('earth') === 1 && n('beam') === 1 && n('air') === 1) {
      const radius = len === 4 ? 7 : 5;
      const duration = len === 4 ? 45 : 30;
      spawnTotem(casterId, ox, oz, duration, radius);
      return;
    }

    // ---------- ОСТАЛЬНЫЕ СТАРЫЕ И УСИЛЕННЫЕ ЗАКЛИНАНИЯ ----------
    // Прыгучесть (air+air+earth) и усиленная
    if (n('air') >= 2 && n('earth') >= 1 && (n('air') + n('earth')) === 3) {
      let power = 1.5, dur = 75;
      if (n('earth') === 2) { power = 1.8; dur = 90; }
      ctx.addEffect(casterId, 'jump_boost', dur, power);
      return;
    }
    // Регенерация (water+light+light) и усиленная
    if (n('water') === 1 && n('light') >= 2) {
      let power = 1, dur = 50;
      if (n('light') === 3) { power = 2; dur = 60; }
      ctx.addEffect(casterId, 'regen', dur, power);
      return;
    }
    // Огнеупорность (fire+earth+shield) и усиленная
    if (n('fire') >= 1 && n('earth') >= 1 && n('shield') === 1 && (n('fire')+n('earth')) === 2) {
      let resist = 0.5, dur = 100;
      if (n('fire') === 2) { resist = 0.75; dur = 120; }
      ctx.addEffect(casterId, 'fire_resist', dur, resist);
      return;
    }
    // Огненная аура (fire+fire+air) и усиленная
    if (n('fire') >= 2 && n('air') >= 1 && (n('fire')+n('air')) === 3) {
      let dmg = 1, rad = 3, dur = 60;
      if (n('air') === 2) { dmg = 2; rad = 4; dur = 70; }
      ctx.addEffect(casterId, 'fire_aura', dur, { power: dmg, radius: rad });
      return;
    }
    // Ледяная кожа (ice+ice+earth) и усиленная
    if (n('ice') >= 2 && n('earth') >= 1 && (n('ice')+n('earth')) === 3) {
      let freezeDur = 2, dur = 75;
      if (n('earth') === 2) { freezeDur = 3; dur = 90; }
      ctx.addEffect(casterId, 'ice_skin', dur, freezeDur);
      return;
    }
    // Разряд (beam+fire+air) и усиленная
    if (n('beam') === 1 && n('fire') >= 1 && n('air') >= 1 && (n('fire')+n('air')) === 2) {
      let chance = 0.2, dur = 40;
      if (n('air') === 2) { chance = 0.35; dur = 50; }
      ctx.addEffect(casterId, 'chain_lightning', dur, chance);
      return;
    }
    // Ослепление (light+dark+air) – разрешённый конфликт
    if (n('light') === 1 && n('dark') === 1 && n('air') === 1) {
      let rad = 5, dur = 15;
      if (len === 4) { rad = 7; dur = 20; }
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        if (Math.hypot(p.x - ox, p.z - oz) < rad) ctx.addEffect(id, 'blind', dur, 1);
      }
      return;
    }
    // Теневой шаг (dark+dark+air) и усиленная
    if (n('dark') >= 2 && n('air') >= 1 && (n('dark')+n('air')) === 3) {
      ctx.emit('shadowStepRequest', { casterId, invisible: n('air') === 2 });
      return;
    }
    // Невесомость (air+air+light) и усиленная
    if (n('air') >= 2 && n('light') >= 1 && (n('air')+n('light')) === 3) {
      ctx.addEffect(casterId, 'weightless', 50, n('light') === 2 ? 2 : 1);
      return;
    }
    // Барьер (shield+earth) и усиленная
    if (n('shield') === 1 && n('earth') >= 1 && (n('shield')+n('earth')) === 2) {
      let power = 4, dur = 75;
      if (n('earth') === 2) { power = 7; dur = 90; }
      ctx.addEffect(casterId, 'ward', dur, { power });
      return;
    }
    // Цепочка послушания (dark+beam+fire) и усиленная
    if (n('dark') === 1 && n('beam') === 1 && n('fire') === 1) {
      let transfer = 0.5;
      if (len === 4) transfer = 0.75;
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 8) { minDist = dist; nearest = id; }
      }
      if (nearest) ctx.chainPlayers(casterId, nearest, transfer);
      return;
    }
    // Массовый левитирующий круг (air+air+water+earth) и усиленная
    if (n('air') === 2 && n('water') === 1 && n('earth') === 1) {
      let rad = 4, dur = 40;
      if (len === 5) { rad = 6; dur = 50; }
      ctx.addZone(ox, oz, rad, 'levitate_circle', casterId, dur);
      return;
    }
    // Обмен местами (dark+air+earth) и усиленная
    if (n('dark') === 1 && n('air') === 1 && n('earth') === 1) {
      let slow = false;
      if (len === 4) slow = true;
      let nearest = null, minDist = Infinity;
      for (const [id, p] of ctx.getPlayers()) {
        if (id === casterId) continue;
        const dist = Math.hypot(p.x - ox, p.z - oz);
        if (dist < minDist && dist < 10) { minDist = dist; nearest = id; }
      }
      if (nearest) {
        ctx.swapPositions(casterId, nearest);
        if (slow) ctx.addEffect(nearest, 'slow', 3, 1);
      }
      return;
    }

    // ---------- СТАРЫЕ ЗАКЛИНАНИЯ (shield, телепорт, метеор и т.д.) ----------
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