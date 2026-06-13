import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createMagicEngine } from '../magic.js';

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(ROOT, path.normalize(urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ===== Типы блоков =====
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, PLANKS = 6, SAND = 7, GRAVEL = 8, COAL_ORE = 9, IRON_ORE = 10;

// ===== Генерация ника =====
const ADJECTIVES = ["Весёлый","Храбрый","Тихий","Быстрый","Умный","Смелый","Добрый","Злой","Магический","Ледяной","Огненный","Тёмный","Светлый","Летающий","Подземный","Древний","Могучий"];
const NOUNS = ["Волшебник","Маг","Чародей","Колдун","Шаман","Друид","Некромант","Иллюзионист","Алхимик","Варлок","Магистр","Архимаг","Мистик","Заклинатель"];
function randomNickname() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${noun}${num}`;
}

// ===== Шум Перлина =====
const PERM = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const p = new Array(512);
for (let i = 0; i < 256; i++) p[i] = p[i+256] = PERM[i];
function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = p[X] + Y, AA = p[A] + Z, AB = p[A+1] + Z;
  const B = p[X+1] + Y, BA = p[B] + Z, BB = p[B+1] + Z;
  return lerp(w,
    lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x-1, y, z)),
            lerp(u, grad(p[AB], x, y-1, z), grad(p[BB], x-1, y-1, z))),
    lerp(v, lerp(u, grad(p[AA+1], x, y, z-1), grad(p[BA+1], x-1, y, z-1)),
            lerp(u, grad(p[AB+1], x, y-1, z-1), grad(p[BB+1], x-1, y-1, z-1))));
}

let seed;
function terrainHeight(wx, wz) {
  let h = 24;
  h += noise(wx / 80 + seed, wz / 80 + seed, 0)   * 16;
  h += noise(wx / 30 + seed, wz / 30 + seed, 100) * 6;
  h += noise(wx / 12 + seed, wz / 12 + seed, 200) * 2;
  const biome = getBiome(wx, wz);
  if (biome === 'desert') {
    h = 28 + noise(wx / 50 + seed, wz / 50 + seed, 400) * 3;
    h = Math.max(24, Math.min(35, h));
  } else if (biome === 'mountain') {
    h += noise(wx / 20 + seed, wz / 20 + seed, 150) * 20;
    h += Math.abs(noise(wx / 6 + seed, wz / 6 + seed, 250)) * 12;
    h = Math.max(45, Math.min(63, h));
  } else {
    h += noise(wx / 25 + seed, wz / 25 + seed, 300) * 6;
    h = Math.max(20, Math.min(50, h));
  }
  return Math.max(1, Math.min(63, Math.floor(h)));
}

function getBiome(wx, wz) {
  const val = noise(wx * 0.005 + seed, wz * 0.005 + seed, 300);
  if (val < -0.25) return 'desert';
  if (val > 0.35) return 'mountain';
  return 'forest';
}

function getBlockType(x, y, z) {
  if (y < 0 || y >= 64) return AIR;
  const key = `${x},${y},${z}`;
  if (edits.has(key)) return edits.get(key);
  const h = terrainHeight(x, z);
  if (y < h) {
    if (y === h-1) {
      const biome = getBiome(x, z);
      if (biome === 'desert') return SAND;
      return GRASS;
    }
    if (y >= h-4) return DIRT;
    if (y < 40 && noise(x * 0.1, y * 0.1, z * 0.1) > 0.85) return IRON_ORE;
    if (y < 60 && noise(x * 0.12, y * 0.12, z * 0.12) > 0.7) return COAL_ORE;
    return STONE;
  }
  return AIR;
}

function generateBigTree(editsMap, cx, cz, groundY) {
  const trunkHeight = 5 + Math.floor(Math.random() * 3);
  const startX = Math.floor(cx), startZ = Math.floor(cz);
  const startY = groundY;
  for (let h = 0; h < trunkHeight; h++) {
    const y = startY + h;
    if (y >= 64) break;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const x = startX + dx, z = startZ + dz;
        if (dx === 0 && dz === 0) editsMap.set(`${x},${y},${z}`, WOOD);
        else if (h < trunkHeight-1) editsMap.set(`${x},${y},${z}`, WOOD);
      }
    }
  }
  const crownY = startY + trunkHeight - 1;
  const radius = 3;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
        if (dist <= radius + 0.5) {
          const x = startX + dx, z = startZ + dz, y = crownY + dy;
          if (y >= 0 && y < 64) {
            const current = getBlockType(x, y, z);
            if (current === AIR || current === LEAVES)
              editsMap.set(`${x},${y},${z}`, LEAVES);
          }
        }
      }
    }
  }
  for (let dy = -1; dy <= 1; dy++) {
    const y = crownY + dy;
    if (y >= 0 && y < 64) editsMap.set(`${startX},${y},${startZ}`, WOOD);
  }
}

seed = Math.floor(Math.random() * 10000);
const edits = new Map();
const players = new Map();
let nextId = 1;

// Предварительная генерация деревьев
for (let cx = -20; cx <= 20; cx++) {
  for (let cz = -20; cz <= 20; cz++) {
    if (Math.random() < 0.1) {
      const centerX = cx * 16 + 8;
      const centerZ = cz * 16 + 8;
      if (getBiome(centerX, centerZ) === 'forest') {
        const groundY = terrainHeight(centerX, centerZ);
        if (groundY < 55) generateBigTree(edits, centerX, centerZ, groundY);
      }
    }
  }
}

const wss = new WebSocketServer({ server: httpServer });

function send(ws, type, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data }));
}
function broadcast(type, data, exceptId = null) {
  const msg = JSON.stringify({ type, ...data });
  for (const [id, q] of players) if (id !== exceptId && q.ws.readyState === 1) q.ws.send(msg);
}
function syncEffects(q) {
  send(q.ws, 'effects', { list: [...q.effects].map(([e, v]) => ({ e, until: v.until, power: v.power })) });
}

// ========== Обработка урона ==========
function applyDamage(targetId, dmg, src = {}) {
  const target = players.get(targetId);
  if (!target) return;
  const attackerId = src.attackerId;
  let weapon = src.weapon || 'неизвестного оружия';
  const attacker = attackerId ? players.get(attackerId) : null;
  
  // Огнеупорность
  if (weapon.includes('огн') && target.effects.has('fire_resist')) {
    const resist = target.effects.get('fire_resist').power;
    dmg *= (1 - resist);
  }
  if (target.effects.has('vulnerability')) dmg *= 1.5;
  if (target.effects.has('weakness')) dmg *= 0.5;
  
  const ward = target.effects.get('ward');
  if (ward && dmg > 0) {
    const absorbed = Math.min(ward.power, dmg);
    ward.power -= absorbed;
    dmg -= absorbed;
    if (ward.power <= 0) target.effects.delete('ward');
    syncEffects(target);
  }
  
  const bonus = target.effects.get('stoneskin')?.power || 0;
  dmg *= 1 - 0.04 * (target.armor + bonus);
  if (dmg <= 0 && !(src.kb > 0)) return;
  
  // Ледяная кожа
  if (target.effects.has('ice_skin') && attackerId && attackerId !== targetId && attacker) {
    if (!attacker.effects.has('freeze')) {
      const freezeDur = target.effects.get('ice_skin').power || 2;
      attacker.effects.set('freeze', { until: Date.now() + freezeDur * 1000, power: 1 });
      syncEffects(attacker);
    }
  }
  
  // Цепочка послушания
  if (target.chainLink && players.has(target.chainLink)) {
    const linked = players.get(target.chainLink);
    if (linked && linked !== target && linked.hp > 0 && dmg > 0) {
      const transferPercent = target.chainTransfer || 0.5;
      const linkedDmg = dmg * transferPercent;
      if (linkedDmg > 0) {
        applyDamage(target.chainLink, linkedDmg, { ...src, weapon: 'цепочки послушания', attackerId, kb: 0 });
      }
    }
  }
  
  // Сфера отражения
  if (target.sphereReflect && target.sphereReflect > 0 && attackerId && attackerId !== targetId && attacker && attacker.hp > 0) {
    const reflected = dmg * target.sphereReflect;
    if (reflected > 0) {
      applyDamage(attackerId, reflected, { weapon: 'отражённый урон', attackerId: targetId });
    }
  }
  
  const wasAlive = target.hp > 0;
  target.hp -= Math.max(0, dmg);
  
  // Феникс-возрождение
  if (target.hp <= 4 && !target.phoenixUsed && target.effects.has('phoenix')) {
    target.phoenixUsed = true;
    target.hp = 8;
    broadcast('systemMessage', { message: `${target.nickname} возродился как Феникс!` });
    broadcast('hp', { id: targetId, hp: target.hp });
    for (const [id, p] of players) {
      if (id === targetId) continue;
      if (Math.hypot(p.x - target.x, p.z - target.z) < 8) {
        p.effects.set('blind', { until: Date.now() + 5000, power: 1 });
        p.effects.set('fear', { until: Date.now() + 5000, power: 1 });
        syncEffects(p);
      }
    }
    return;
  }
  
  if (target.hp <= 0 && wasAlive) {
    target.hp = 20;
    target.effects.clear();
    syncEffects(target);
    broadcast('respawn', { id: targetId });
    broadcast('hp', { id: targetId, hp: 20 });
    target.phoenixUsed = false;
    if (attackerId && attackerId !== targetId && attacker) {
      const killMsg = `${attacker.nickname} убил ${target.nickname} с помощью ${weapon}`;
      broadcast('systemMessage', { message: killMsg });
      console.log(killMsg);
    } else {
      broadcast('systemMessage', { message: `${target.nickname} погиб` });
    }
  } else {
    if (dmg > 0) broadcast('hp', { id: targetId, hp: target.hp });
    send(target.ws, 'damaged', {
      ax: src.ax ?? target.x,
      az: src.az ?? target.z,
      hp: target.hp,
      kb: src.kb ?? 6
    });
  }
}

// ========== Зоны, тотемы, вспомогательные функции ==========
const activeZones = new Map();
function addZone(x, z, radius, effect, ownerId, duration) {
  const id = Math.random();
  activeZones.set(id, { x, z, radius, effect, owner: ownerId, until: Date.now() + duration * 1000 });
  setTimeout(() => activeZones.delete(id), duration * 1000);
  broadcast('zoneSpawn', { id, x, z, radius, effect, duration });
}

const timeSlowZones = new Map();
function addTimeSlowZone(casterId, x, z, radius, duration) {
  const zoneId = Math.random();
  timeSlowZones.set(zoneId, { x, z, radius, endTime: Date.now() + duration * 1000, casterId });
  broadcast('timeSlowZone', { zoneId, x, z, radius, duration });
  setTimeout(() => timeSlowZones.delete(zoneId), duration * 1000);
}

const activeTotems = new Map();
function addTotem(casterId, x, z, radius, duration) {
  const id = Math.random();
  let lastTick = Date.now();
  const interval = setInterval(() => {
    const now = Date.now();
    if (now - lastTick >= 3000) {
      lastTick = now;
      const playersInRange = [...players.values()].filter(p => p.id !== casterId && Math.hypot(p.x - x, p.z - z) < radius);
      if (playersInRange.length) {
        const randomTarget = playersInRange[Math.floor(Math.random() * playersInRange.length)];
        randomTarget.effects.set('speed', { until: now + 5000, power: 1.5 });
        syncEffects(randomTarget);
        broadcast('totemCharge', { targetId: randomTarget.id, casterId });
        broadcast('totemPower', { targetId: randomTarget.id, power: 6 });
      }
    }
  }, 3000);
  activeTotems.set(id, { x, z, radius, endTime: Date.now() + duration * 1000, casterId, interval });
  broadcast('totemSpawn', { id, x, z, radius, duration });
  setTimeout(() => {
    const t = activeTotems.get(id);
    if (t) { clearInterval(t.interval); activeTotems.delete(id); broadcast('totemEnd', { id }); }
  }, duration * 1000);
}

// ========== Контекст для магии ==========
const magicCtx = {
  getBlock: (x,y,z) => getBlockType(x,y,z),
  setBlock(x,y,z,t) { edits.set(`${x},${y},${z}`, t); broadcast('blockUpdate',{x,y,z,t}); },
  terrainHeight,
  getPlayers: () => [...players].map(([id,q]) => [id, { x: q.x, y: q.y, z: q.z }]),
  applyDamage,
  addEffect(id, type, dur, power) {
    const q = players.get(id);
    if (!q) return;
    let powerValue = power?.power ?? power;
    if (type === 'regen') {
      q.effects.set(type, { until: Date.now() + dur*1000, power: powerValue, lastTick: Date.now() });
    } else {
      q.effects.set(type, { until: Date.now() + dur*1000, power: powerValue });
    }
    if (type === 'phoenix') q.phoenixUsed = false;
    syncEffects(q);
  },
  healPlayer(id, amount) {
    const q = players.get(id);
    if (!q || q.effects.has('curse')) return;
    q.hp = Math.min(20, q.hp + amount);
    broadcast('hp', { id, hp: q.hp });
  },
  clearDebuffs(id) {
    const q = players.get(id);
    if (!q) return;
    for (const b of ['burning','slow','freeze','curse','blind','weakness','vulnerability','disorient','disarm','shadow_shackles']) q.effects.delete(b);
    syncEffects(q);
  },
  getMana: (id) => players.get(id)?.mana ?? 0,
  spendMana(id, cost) {
    const q = players.get(id);
    if (!q) return;
    q.mana -= cost;
    send(q.ws, 'mana', { mana: Math.floor(q.mana) });
  },
  teleportPlayer(id, x, y, z) {
    const q = players.get(id);
    if (!q) return;
    q.x = x; q.y = y; q.z = z;
    broadcast('teleport', { id, x: q.x, y: q.y, z: q.z });
  },
  emit: (type, data) => broadcast(type, data),
  addZone,
  addTotem,
  addTimeSlowZone,
  chainPlayers: (casterId, targetId, transfer = 0.5) => {
    const caster = players.get(casterId);
    const target = players.get(targetId);
    if (!caster || !target) return false;
    if (caster.chainLink) delete players.get(caster.chainLink)?.chainLink;
    if (target.chainLink) delete players.get(target.chainLink)?.chainLink;
    caster.chainLink = targetId;
    target.chainLink = casterId;
    caster.chainTransfer = transfer;
    target.chainTransfer = transfer;
    broadcast('chainLink', { id1: casterId, id2: targetId });
    return true;
  },
  swapPositions: (id1, id2) => {
    const p1 = players.get(id1);
    const p2 = players.get(id2);
    if (!p1 || !p2) return;
    [p1.x, p2.x] = [p2.x, p1.x];
    [p1.y, p2.y] = [p2.y, p1.y];
    [p1.z, p2.z] = [p2.z, p1.z];
    broadcast('teleport', { id: id1, x: p1.x, y: p1.y, z: p1.z });
    broadcast('teleport', { id: id2, x: p2.x, y: p2.y, z: p2.z });
    broadcast('swapFx', { id1, id2 });
  },
  createProtectionSphere: (casterId, x, y, z, duration) => {
    const caster = players.get(casterId);
    if (!caster) return;
    caster.sphereEnd = Date.now() + duration * 1000;
    caster.sphereReflect = 0.5;
    broadcast('sphereSpawn', { casterId, x, y, z, radius: 3, duration });
    const interval = setInterval(() => {
      if (!caster || Date.now() > caster.sphereEnd) {
        clearInterval(interval);
        if (caster) caster.sphereReflect = null;
        broadcast('sphereEnd', { casterId });
        return;
      }
      for (const [id, p] of players) {
        if (Math.hypot(p.x - x, p.z - z) < 3 && p.y > y-1 && p.y < y+2) {
          p.hp = Math.min(20, p.hp + 2);
          broadcast('hp', { id, hp: p.hp });
        }
      }
    }, 1000);
    setTimeout(() => {
      clearInterval(interval);
      if (caster) caster.sphereReflect = null;
      broadcast('sphereEnd', { casterId });
    }, duration * 1000);
  },
  summonAsteroid: (casterId, x, z, yaw) => {
    const impactX = x + Math.sin(yaw) * 3;
    const impactZ = z + Math.cos(yaw) * 3;
    broadcast('asteroidStart', { casterId, x: impactX, z: impactZ, startY: 60 });
    setTimeout(() => {
      const radius = 5;
      const dmg = 18;
      // Взрыв
      const explodeFn = (xx, yy, zz, rad, dmg2, owner) => {
        const rr = rad * 1.6;
        for (const [id, p] of players) {
          if (id === owner) continue;
          const d2 = (p.x - xx)**2 + (p.y + 0.9 - yy)**2 + (p.z - zz)**2;
          if (d2 < rr*rr) {
            const actualDmg = dmg2 * (1 - Math.sqrt(d2)/rr);
            applyDamage(id, actualDmg, { ax: xx, az: zz, kb: 6+rad, attackerId: casterId, weapon: 'астероида' });
          }
        }
        for (let dx = -rad; dx <= rad; dx++) {
          for (let dz = -rad; dz <= rad; dz++) {
            const dist = Math.hypot(dx, dz);
            if (dist < rad) {
              const bx = Math.floor(impactX + dx);
              const bz = Math.floor(impactZ + dz);
              const y = terrainHeight(bx, bz);
              for (let h = 0; h < Math.max(1, rad - Math.floor(dist)); h++) {
                edits.set(`${bx},${y+h},${bz}`, STONE);
                broadcast('blockUpdate', { x: bx, y: y+h, z: bz, t: STONE });
              }
            }
          }
        }
        broadcast('asteroidImpact', { x: impactX, z: impactZ, radius: rad });
      };
      explodeFn(impactX, 0, impactZ, radius, dmg, casterId);
    }, 1500);
  },
  stomp: (casterId, x, z, radius) => {
    broadcast('stompFx', { x, z, radius });
    for (const [id, p] of players) {
      if (id === casterId) continue;
      const dist = Math.hypot(p.x - x, p.z - z);
      if (dist < radius) {
        p.y += 3;
        broadcast('teleport', { id, x: p.x, y: p.y, z: p.z });
        applyDamage(id, 8, { ax: x, az: z, kb: 12, attackerId: casterId, weapon: 'топота' });
        p.effects.set('disarm', { until: Date.now() + 5000, power: 1 });
        syncEffects(p);
      }
    }
  },
  blackVortex: (casterId, x, z, duration) => {
    broadcast('vortexSpawn', { vortexId: Math.random(), x, z, radius: 4, duration });
    const endTime = Date.now() + duration * 1000;
    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(interval);
        broadcast('vortexEnd', {});
        return;
      }
      for (const [id, p] of players) {
        if (id !== casterId && Math.hypot(p.x - x, p.z - z) < 6) {
          applyDamage(id, 6, { ax: x, az: z, kb: 5, attackerId: casterId, weapon: 'чёрного вихря' });
        }
      }
    }, 1000);
  },
  lightCage: (casterId, targetId) => {
    broadcast('cageSpawn', { casterId, targetId });
    const endTime = Date.now() + 6000;
    const interval = setInterval(() => {
      if (Date.now() > endTime) {
        clearInterval(interval);
        broadcast('cageEnd', { targetId });
        return;
      }
      applyDamage(targetId, 4, { ax: 0, az: 0, kb: 0, attackerId: casterId, weapon: 'световой клетки' });
    }, 1000);
  },
  shadowShackles: (casterId, targetId) => {
    const target = players.get(targetId);
    if (target) {
      target.effects.set('shadow_shackles', { until: Date.now() + 6000, power: 1 });
      syncEffects(target);
      broadcast('shacklesFx', { targetId });
    }
  },
  dragonBreath: (casterId, origin, dir, yaw, coneAngle = Math.PI/3, maxDist = 8, damage = 8, knockback = 10) => {
    for (const [id, p] of players) {
      if (id === casterId) continue;
      const toTarget = { x: p.x - origin.x, z: p.z - origin.z };
      const dist = Math.hypot(toTarget.x, toTarget.z);
      if (dist > maxDist) continue;
      const forward = { x: Math.sin(yaw), z: Math.cos(yaw) };
      const dot = (toTarget.x * forward.x + toTarget.z * forward.z) / dist;
      if (dot >= Math.cos(coneAngle)) {
        applyDamage(id, damage, { ax: origin.x, az: origin.z, kb: knockback, attackerId: casterId, weapon: 'дыхания дракона' });
        players.get(id)?.effects.set('burning', { until: Date.now() + 4000, power: 1 });
        players.get(id)?.effects.set('freeze', { until: Date.now() + 2000, power: 1 });
        players.get(id)?.effects.set('weakness', { until: Date.now() + 5000, power: 0.7 });
        syncEffects(players.get(id));
        broadcast('dragonBreathFx', { from: origin, to: p });
      }
    }
    broadcast('dragonBreathCone', { origin, dir, yaw });
  },
};

const magic = createMagicEngine(magicCtx);

// ========== Тик ==========
const TICK = 50;
let lastManaSync = 0;
setInterval(() => {
  const now = Date.now(), dt = TICK / 1000;
  for (const [id, q] of players) {
    let changed = false;
    for (const [e, v] of q.effects) if (now > v.until) { q.effects.delete(e); changed = true; }
    
    const regen = q.effects.get('regen');
    if (regen && now >= (regen.lastTick + 1000)) {
      regen.lastTick = now;
      if (!q.effects.has('curse')) {
        q.hp = Math.min(20, q.hp + regen.power);
        broadcast('hp', { id, hp: q.hp });
      }
    }
    
    const aura = q.effects.get('fire_aura');
    if (aura) {
      if (!q.lastAuraTick) q.lastAuraTick = 0;
      if (now - q.lastAuraTick >= 1000) {
        q.lastAuraTick = now;
        const rad = aura.radius || 3;
        const dmg = aura.power;
        for (const [pid, p] of players) {
          if (pid === id) continue;
          if (Math.hypot(q.x - p.x, q.z - p.z) < rad) {
            applyDamage(pid, dmg, { attackerId: id, weapon: 'огненной ауры', kb: 0 });
            if (!p.effects.has('burning')) {
              p.effects.set('burning', { until: now + 3000, power: 1 });
              syncEffects(p);
            }
          }
        }
      }
    }
    
    const burn = q.effects.get('burning');
    if (burn) {
      q.burnAcc = (q.burnAcc || 0) + dt;
      if (q.burnAcc >= 1) { q.burnAcc -= 1; applyDamage(id, burn.power, { kb: 0 }); }
    }
    
    if (changed) syncEffects(q);
    q.mana = Math.min(20, q.mana + dt);
  }
  
  for (const [zoneId, zone] of activeZones) {
    if (now > zone.until) { activeZones.delete(zoneId); broadcast('zoneEnd', { id: zoneId }); continue; }
    if (zone.effect === 'levitate_circle') {
      for (const [pid, p] of players) {
        if (Math.hypot(p.x - zone.x, p.z - zone.z) < zone.radius && !p.effects.has('levitate')) {
          p.effects.set('levitate', { until: now + 500, power: 1 });
          syncEffects(p);
        }
      }
    }
  }
  
  for (const [zoneId, zone] of timeSlowZones) {
    if (now > zone.endTime) { timeSlowZones.delete(zoneId); continue; }
    for (const [pid, p] of players) {
      if (pid === zone.casterId) continue;
      if (Math.hypot(p.x - zone.x, p.z - zone.z) < zone.radius) {
        if (!p.effects.has('time_slow')) {
          p.effects.set('time_slow', { until: now + 500, power: 0.5 });
          syncEffects(p);
        }
      }
    }
  }
  
  if (now - lastManaSync > 1000) {
    lastManaSync = now;
    for (const q of players.values()) send(q.ws, 'mana', { mana: Math.floor(q.mana) });
  }
  magic.tick(dt);
}, TICK);

// ========== WebSocket ==========
wss.on('connection', (ws) => {
  const id = nextId++;
  const nickname = randomNickname();
  players.set(id, {
    id, ws, nickname,
    x: 0.5, y: 80, z: 0.5, yaw: 0,
    hp: 20, armor: 0, mana: 20, lastAttack: 0, effects: new Map(),
    phoenixUsed: false,
  });
  console.log(`+ ${nickname} (id ${id}) · всего: ${players.size}`);
  send(ws, 'init', {
    id, nickname, seed, edits: [...edits],
    snapshot: magic.getSnapshot(),
    players: [...players].filter(([pid]) => pid !== id)
      .map(([pid, q]) => ({ id: pid, nickname: q.nickname, x: q.x, y: q.y, z: q.z, yaw: q.yaw })),
    zones: [...activeZones].map(([zid, z]) => ({ id: zid, x: z.x, z: z.z, radius: z.radius, effect: z.effect })),
    timeSlowZones: [...timeSlowZones].map(([zid, z]) => ({ id: zid, x: z.x, z: z.z, radius: z.radius, duration: (z.endTime - Date.now())/1000 })),
  });
  broadcast('join', { id, nickname }, id);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    const q = players.get(id);
    if (!q) return;
    if (msg.type === 'move') {
      q.x = msg.x; q.y = msg.y; q.z = msg.z; q.yaw = msg.yaw;
      broadcast('move', { id, x: q.x, y: q.y, z: q.z, yaw: q.yaw }, id);
    } else if (msg.type === 'setBlock') {
      edits.set(`${msg.x},${msg.y},${msg.z}`, msg.t);
      broadcast('blockUpdate', { x: msg.x, y: msg.y, z: msg.z, t: msg.t }, id);
    } else if (msg.type === 'attack') {
      const t = players.get(msg.target);
      const now = Date.now();
      if (!t || now - q.lastAttack < 400) return;
      if ((q.x - t.x) ** 2 + (q.y - t.y) ** 2 + (q.z - t.z) ** 2 > 36) return;
      q.lastAttack = now;
      if (q.effects.has('chain_lightning') && Math.random() < (q.effects.get('chain_lightning').power || 0.2)) {
        applyDamage(msg.target, 6, { ax: q.x, az: q.z, kb: 5, attackerId: id, weapon: 'разряда' });
        const candidates = [...players.values()].filter(p => p.id !== id && p.id !== msg.target && Math.hypot(p.x - t.x, p.z - t.z) < 5);
        if (candidates.length) {
          const next = candidates[0];
          applyDamage(next.id, 4, { ax: q.x, az: q.z, kb: 3, attackerId: id, weapon: 'разряда (перескок)' });
          broadcast('lightningEffect', { from: msg.target, to: next.id });
        } else {
          broadcast('lightningEffect', { from: id, to: msg.target });
        }
      }
      applyDamage(msg.target, 4, { ax: q.x, az: q.z, kb: 8, attackerId: id, weapon: 'меча' });
    } else if (msg.type === 'cast') {
      magic.cast(id, msg.elements, msg.dir, { x: q.x, y: q.y + 1.62, z: q.z }, q.yaw);
    } else if (msg.type === 'chat') {
      broadcast('chat', { senderId: id, senderNick: q.nickname, message: msg.message }, id);
    } else if (msg.type === 'shadow_step') {
      let nearest = null, minDist = Infinity;
      for (const [pid, p] of players) {
        if (pid === id) continue;
        const dist = Math.hypot(q.x - p.x, q.z - p.z);
        if (dist < minDist && dist < 10) { minDist = dist; nearest = p; }
      }
      if (nearest) {
        const dirX = -Math.sin(nearest.yaw), dirZ = -Math.cos(nearest.yaw);
        const teleX = nearest.x + dirX * 1.5;
        const teleZ = nearest.z + dirZ * 1.5;
        const teleY = terrainHeight(teleX, teleZ) + 1;
        const oldX = q.x, oldZ = q.z;
        q.x = teleX; q.y = teleY; q.z = teleZ;
        broadcast('teleport', { id, x: q.x, y: q.y, z: q.z });
        broadcast('shadowStepFx', { x0: oldX, z0: oldZ, x1: q.x, z1: q.z });
        broadcast('systemMessage', { message: `${q.nickname} использовал Теневой шаг` });
      } else {
        send(q.ws, 'systemMessage', { message: 'Нет цели для теневого шага' });
      }
    } else if (msg.type === 'swap_positions') {
      const target = players.get(msg.target);
      if (target && Math.hypot(q.x - target.x, q.z - target.z) < 10) {
        magicCtx.swapPositions(id, msg.target);
      }
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast('leave', { id });
    console.log(`- ${nickname} (id ${id}) · всего: ${players.size}`);
  });
});

const PORT = process.env.PORT || 8081;
httpServer.listen(PORT, () => console.log(`Игра: http://localhost:${PORT} · сид: ${seed}`));