import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createMagicEngine } from '../magic.js';

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

// ===== Генерация случайного ника =====
const ADJECTIVES = ["Весёлый", "Храбрый", "Тихий", "Быстрый", "Умный", "Смелый", "Добрый", "Злой", "Магический", "Ледяной", "Огненный", "Тёмный", "Светлый", "Летающий", "Подземный", "Древний", "Могучий"];
const NOUNS = ["Волшебник", "Маг", "Чародей", "Колдун", "Шаман", "Друид", "Некромант", "Иллюзионист", "Алхимик", "Варлок", "Магистр", "Архимаг", "Мистик", "Заклинатель"];
function randomNickname() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(Math.random() * 1000);
    return `${adj}${noun}${num}`;
}

// ===== Шум Перлина =====
const PERM = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const p = new Array(512);
for (let i = 0; i < 256; i++) p[i] = p[i + 256] = PERM[i];
const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (t, a, b) => a + t * (b - a);
function grad(h, x, y, z) {
  h &= 15;
  const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
  const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
  return lerp(w,
    lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
            lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))),
    lerp(v, lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
            lerp(u, grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1))));
}
let seed;
function terrainHeight(wx, wz) {
  let h = 24;
  h += noise(wx / 80 + seed, wz / 80 + seed, 0) * 16;
  h += noise(wx / 30 + seed, wz / 30 + seed, 100) * 6;
  h += noise(wx / 12 + seed, wz / 12 + seed, 200) * 2;
  return Math.max(1, Math.min(63, Math.floor(h)));
}

// ===== Состояние =====
seed = Math.floor(Math.random() * 10000);
const edits = new Map();
const players = new Map(); // id -> { ws, x, y, z, yaw, hp, armor, mana, lastAttack, effects, nickname }
let nextId = 1;

const wss = new WebSocketServer({ server: httpServer });

function send(ws, type, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data }));
}

function broadcast(type, data, exceptId = null) {
  const msg = JSON.stringify({ type, ...data });
  for (const [id, q] of players) {
    if (id !== exceptId && q.ws.readyState === 1) {
      q.ws.send(msg);
    }
  }
}

function syncEffects(q) {
  send(q.ws, 'effects', { list: [...q.effects].map(([e, v]) => ({ e, until: v.until, power: v.power })) });
}

function applyDamage(targetId, dmg, src = {}) {
  const t = players.get(targetId);
  if (!t) return;
  const ward = t.effects.get('ward');
  if (ward && dmg > 0) {
    const absorbed = Math.min(ward.power, dmg);
    ward.power -= absorbed; dmg -= absorbed;
    if (ward.power <= 0) t.effects.delete('ward');
    syncEffects(t);
  }
  const bonus = t.effects.get('stoneskin')?.power || 0;
  dmg *= 1 - 0.04 * (t.armor + bonus);
  if (dmg <= 0 && !(src.kb > 0)) return;
  t.hp -= Math.max(0, dmg);
  if (t.hp <= 0) {
    t.hp = 20; t.effects.clear(); syncEffects(t);
    broadcast('respawn', { id: targetId });
    broadcast('hp', { id: targetId, hp: 20 });
  } else {
    if (dmg > 0) broadcast('hp', { id: targetId, hp: t.hp });
    send(t.ws, 'damaged', { ax: src.ax ?? t.x, az: src.az ?? t.z, hp: t.hp, kb: src.kb ?? 6 });
  }
}

// ===== Контекст для движка магии =====
const magicCtx = {
  getBlock(x, y, z) {
    if (y < 0 || y >= 64) return 0;
    const key = `${x},${y},${z}`;
    if (edits.has(key)) return edits.get(key);
    const h = terrainHeight(x, z);
    return y < h ? (y === h - 1 ? 1 : y >= h - 4 ? 2 : 3) : 0;
  },
  setBlock(x, y, z, t) {
    edits.set(`${x},${y},${z}`, t);
    broadcast('blockUpdate', { x, y, z, t });
  },
  terrainHeight,
  getPlayers: () => [...players].map(([id, q]) => [id, { x: q.x, y: q.y, z: q.z }]),
  applyDamage,
  addEffect(id, type, dur, power) {
    const q = players.get(id);
    if (!q) return;
    q.effects.set(type, { until: Date.now() + dur * 1000, power: power?.power ?? power });
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
    for (const b of ['burning', 'slow', 'freeze', 'curse']) q.effects.delete(b);
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
    broadcast('teleport', { id, x, y, z });
  },
  emit: (type, data) => broadcast(type, data),
};
const magic = createMagicEngine(magicCtx);

// ===== Тик 20 TPS =====
const TICK = 50;
let lastManaSync = 0;
setInterval(() => {
  const now = Date.now(), dt = TICK / 1000;
  for (const [id, q] of players) {
    let changed = false;
    for (const [e, v] of q.effects)
      if (now > v.until) { q.effects.delete(e); changed = true; }
    const burn = q.effects.get('burning');
    if (burn) {
      q.burnAcc = (q.burnAcc || 0) + dt;
      if (q.burnAcc >= 1) { q.burnAcc -= 1; applyDamage(id, burn.power, { kb: 0 }); }
    }
    if (changed) syncEffects(q);
    q.mana = Math.min(20, q.mana + dt);
  }
  if (now - lastManaSync > 1000) {
    lastManaSync = now;
    for (const q of players.values()) send(q.ws, 'mana', { mana: Math.floor(q.mana) });
  }
  magic.tick(dt);
}, TICK);

// ===== Подключения =====
wss.on('connection', (ws) => {
  const id = nextId++;
  const nickname = randomNickname();
  players.set(id, {
    id, ws, nickname,
    x: 0.5, y: 80, z: 0.5, yaw: 0,
    hp: 20, armor: 0, mana: 20, lastAttack: 0, effects: new Map(),
  });
  console.log(`+ ${nickname} (id ${id}) · всего: ${players.size}`);
  send(ws, 'init', {
    id, nickname, seed, edits: [...edits],
    snapshot: magic.getSnapshot(),
    players: [...players].filter(([pid]) => pid !== id)
      .map(([pid, q]) => ({ id: pid, nickname: q.nickname, x: q.x, y: q.y, z: q.z, yaw: q.yaw })),
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
      applyDamage(msg.target, 4, { ax: q.x, az: q.z, kb: 8 });
    } else if (msg.type === 'cast') {
      magic.cast(id, msg.elements, msg.dir, { x: q.x, y: q.y + 1.62, z: q.z }, q.yaw);
    } else if (msg.type === 'chat') {
      broadcast('chat', { senderId: id, senderNick: q.nickname, message: msg.message }, id);
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