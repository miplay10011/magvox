import * as THREE from 'three';
import { World, buildChunkMesh, buildLODMesh, AIR, BLOCK_COLORS, CHUNK_SIZE } from './world.js';
import { Network } from './network.js';
import { createMagicEngine } from './magic.js';

// ========== Рендер ==========
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 400, 1400);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1500);
camera.rotation.order = 'YXZ';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(1, 2, 0.5);
scene.add(sun, new THREE.AmbientLight(0xffffff, 0.4));

const statusEl = document.getElementById('status');
const setStatus = s => statusEl.textContent = s;

// ========== Партиклы ==========
const MAX_P = 3000;
const pGeo = new THREE.BufferGeometry();
const pPosArr = new Float32Array(MAX_P * 3), pColArr = new Float32Array(MAX_P * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPosArr, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pColArr, 3));
const pPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.18, vertexColors: true, transparent: true, opacity: 0.9,
}));
pPoints.frustumCulled = false;
scene.add(pPoints);
const particles = [];

function spawnParticles(x, y, z, color, count, spread, life = 0.8) {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    if (particles.length >= MAX_P) particles.shift();
    particles.push({
      x, y, z,
      vx: (Math.random() - 0.5) * spread,
      vy: Math.random() * spread * 0.8,
      vz: (Math.random() - 0.5) * spread,
      life: life * (0.5 + Math.random() * 0.5),
      r: c.r, g: c.g, b: c.b,
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { particles.splice(i, 1); continue; }
    pt.vy -= 6 * dt;
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.z += pt.vz * dt;
  }
  particles.forEach((pt, i) => {
    pPosArr.set([pt.x, pt.y, pt.z], i * 3);
    pColArr.set([pt.r, pt.g, pt.b], i * 3);
  });
  pGeo.setDrawRange(0, particles.length);
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

// ========== Игрок ==========
const PLAYER = { width: 0.6, height: 1.8, eye: 1.62 };
const GRAVITY = 28, JUMP_SPEED = 9, WALK_SPEED = 5, FLY_SPEED = 12;

const player = {
  pos: new THREE.Vector3(0.5, 80, 0.5),
  vel: new THREE.Vector3(),
  knock: new THREE.Vector3(),
  onGround: false,
  flying: false,
};
let yaw = 0, pitch = 0;
const SENS = 0.002;

// ========== Мир + менеджер чанков ==========
let world = null;
const FULL_RADIUS = 5;
const LOD_RINGS = [
  { level: 1, radius: 6 },
  { level: 2, radius: 20 },
  { level: 3, radius: 40 },
];
const FULL_BUDGET = 4, LOD_BUDGET = 7;
const lodMeshes = new Map();

function remeshChunk(chunk) {
  if (chunk.mesh) { scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
  chunk.mesh = buildChunkMesh(world, chunk);
  scene.add(chunk.mesh);
}

function startWorld(seed, edits = []) {
  world = new World(seed);
  for (const [key, t] of edits) world.edits.set(key, t);
  player.pos.set(0.5, world.terrainHeight(0, 0) + 1, 0.5);
  player.vel.set(0, 0, 0);
  chunkManagerTick();
}

function chunkManagerTick() {
  if (!world) return;
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
  const pcz = Math.floor(player.pos.z / CHUNK_SIZE);

  const wantFull = new Set(), missing = [];
  for (let dx = -FULL_RADIUS; dx <= FULL_RADIUS; dx++)
    for (let dz = -FULL_RADIUS; dz <= FULL_RADIUS; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      wantFull.add(world.key(cx, cz));
      if (!world.getChunk(cx, cz)) missing.push([cx, cz, dx * dx + dz * dz]);
    }
  missing.sort((a, b) => a[2] - b[2]);
  for (const [cx, cz] of missing.slice(0, FULL_BUDGET)) {
    remeshChunk(world.generateChunk(cx, cz));
    for (const [nx, nz] of [[cx + 1, cz], [cx - 1, cz], [cx, cz + 1], [cx, cz - 1]]) {
      const nb = world.getChunk(nx, nz);
      if (nb?.mesh) remeshChunk(nb);
    }
  }
  for (const [key, c] of world.chunks) {
    if (wantFull.has(key)) continue;
    if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    world.chunks.delete(key);
  }

  const wantLod = new Set(), lodMissing = [];
  let inner = FULL_RADIUS;
  for (const { level, radius } of LOD_RINGS) {
    const s = 1 << level;
    for (let gx = Math.floor((pcx - radius) / s); gx <= Math.floor((pcx + radius) / s); gx++)
      for (let gz = Math.floor((pcz - radius) / s); gz <= Math.floor((pcz + radius) / s); gz++) {
        const d = Math.max(Math.abs(gx * s + s / 2 - pcx), Math.abs(gz * s + s / 2 - pcz));
        if (d > radius || d <= inner) continue;
        const key = `${level}:${gx},${gz}`;
        wantLod.add(key);
        if (!lodMeshes.has(key)) lodMissing.push([key, gx, gz, level, d]);
      }
    inner = radius;
  }
  lodMissing.sort((a, b) => a[4] - b[4]);
  for (const [key, gx, gz, level] of lodMissing.slice(0, LOD_BUDGET)) {
    const mesh = buildLODMesh(world, gx, gz, level);
    lodMeshes.set(key, mesh);
    scene.add(mesh);
  }
  for (const [key, mesh] of lodMeshes) {
    if (wantLod.has(key)) continue;
    scene.remove(mesh); mesh.geometry.dispose(); lodMeshes.delete(key);
  }
}
setInterval(chunkManagerTick, 250);

// ========== Статы и эффекты ==========
const stats = { hp: 20, armor: 0, mana: 20, maxMana: 20 };
const activeEffects = new Map();
let burnAcc = 0;

const heartsEl = document.getElementById('hearts');
const manaFill = document.getElementById('mana-fill');
const flashEl = document.getElementById('damage-flash');
const effectsEl = document.getElementById('effects-hud');

function renderStats() {
  let s = '';
  for (let i = 0; i < 10; i++)
    s += `<span style="color:${stats.hp >= (i + 1) * 2 - 1 ? '#e33' : '#444'}">\u2665</span>`;
  s += '  ';
  for (let i = 0; i < 5; i++)
    s += `<span style="color:${stats.armor >= (i + 1) * 4 ? '#ccc' : '#444'}">\u26E8</span>`;
  heartsEl.innerHTML = s;
  manaFill.style.width = (Math.max(0, stats.mana) / stats.maxMana * 100) + '%';
}
renderStats();

function damageFlash() {
  flashEl.style.transition = 'none';
  flashEl.style.opacity = 1;
  requestAnimationFrame(() => {
    flashEl.style.transition = 'opacity 0.4s';
    flashEl.style.opacity = 0;
  });
}

const EFFECT_NAMES = {
  burning: '🔥 Горение', slow: '🐌 Замедление', freeze: '❄ Заморозка',
  curse: '🌑 Проклятие', ward: '🛡 Барьер', stoneskin: '🪨 Кам. кожа',
  speed: '💨 Ускорение', levitate: '🕊 Левитация',
};
function effectActive(name) {
  const e = activeEffects.get(name);
  return e && e.until > Date.now() ? e : null;
}
let lastFxRender = 0;
function renderEffects(now) {
  if (now - lastFxRender < 250) return;
  lastFxRender = now;
  let html = '';
  for (const [e, v] of activeEffects) {
    if (v.until < Date.now()) { activeEffects.delete(e); continue; }
    html += `${EFFECT_NAMES[e] || e} ${Math.ceil((v.until - Date.now()) / 1000)}с` +
            (e === 'ward' ? ` (${v.power})` : '') + '<br>';
  }
  effectsEl.innerHTML = html;
}

// ========== Магия: кольцо элементов, очередь ==========
const ELEMENTS = [
  { id: 'fire',   icon: '🔥', color: '#f4502a' },
  { id: 'water',  icon: '💧', color: '#3a6cf4' },
  { id: 'air',    icon: '💨', color: '#9fd8ef' },
  { id: 'earth',  icon: '🪨', color: '#8b5a2b' },
  { id: 'beam',   icon: '⚡', color: '#ffd34d' },
  { id: 'ice',    icon: '❄',  color: '#9ff' },
  { id: 'shield', icon: '🛡', color: '#9a9' },
  { id: 'light',  icon: '☀',  color: '#ffe9a0' },
  { id: 'dark',   icon: '🌑', color: '#603a80' },
];
const CONFLICTS = [['fire', 'water'], ['fire', 'ice'], ['light', 'dark']];

let combatMode = false;
const spellQueue = [];

const ringEl = document.getElementById('magic-ring');
const queueEl = document.getElementById('spell-queue');
const iconEls = [];
ELEMENTS.forEach((el, i) => {
  const a = -Math.PI / 2 + i * 2 * Math.PI / 9;
  const d = document.createElement('div');
  d.className = 'element-icon';
  d.style.left = Math.cos(a) * 70 + 'px';
  d.style.top  = Math.sin(a) * 70 + 'px';
  d.style.background = el.color + '55';
  d.innerHTML = `${el.icon}<span class="num">${i + 1}</span>`;
  ringEl.appendChild(d);
  iconEls.push(d);
});

function flashIcon(i) {
  iconEls[i].classList.add('flash');
  setTimeout(() => iconEls[i].classList.remove('flash'), 200);
}
function refreshQueueUI() {
  queueEl.innerHTML = '';
  for (const id of spellQueue) {
    const el = ELEMENTS.find(e => e.id === id);
    const d = document.createElement('div');
    d.className = 'queued';
    d.style.background = el.color;
    d.textContent = el.icon;
    queueEl.appendChild(d);
  }
}
function addElement(i) {
  if (spellQueue.length >= 5) return;
  const id = ELEMENTS[i].id;
  for (const [a, b] of CONFLICTS) {
    const other = id === a ? b : id === b ? a : null;
    if (other && spellQueue.includes(other)) return;
  }
  spellQueue.push(id);
  flashIcon(i);
  refreshQueueUI();
}

// ========== Снаряды, мины, временные визуалы ==========
const PROJ_COLORS = {
  fire: 0xf4502a, water: 0x3a6cf4, air: 0xbfe8ff, earth: 0x8b5a2b,
  ice: 0x9ff5ff, dark: 0x603a80, light: 0xffe9a0, beam: 0xffd34d,
};
const projGeo = new THREE.SphereGeometry(0.25, 8, 6);
const projectiles = new Map();
const mineMeshes = new Map();
const transients = [];

function spawnTransient(mesh, life, grow = 0) {
  scene.add(mesh);
  transients.push({ mesh, life, maxLife: life, grow });
}
function updateTransients(dt) {
  for (let i = transients.length - 1; i >= 0; i--) {
    const t = transients[i];
    t.life -= dt;
    if (t.grow) t.mesh.scale.addScalar(t.grow * dt);
    if (t.mesh.material.opacity !== undefined)
      t.mesh.material.opacity = Math.max(0, t.life / t.maxLife);
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      transients.splice(i, 1);
    }
  }
}

// ========== Сеть ==========
const SERVER_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
let myId = null;
const remotePlayers = new Map();
const remoteGeo = new THREE.BoxGeometry(PLAYER.width, PLAYER.height, PLAYER.width);

function addRemotePlayer(id, p) {
  if (id === myId || remotePlayers.has(id)) return;
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL((id * 0.61) % 1, 0.7, 0.5),
  });
  const mesh = new THREE.Mesh(remoteGeo, mat);
  mesh.position.set(p.x, p.y + PLAYER.height / 2, p.z);
  scene.add(mesh);
  remotePlayers.set(id, { mesh, target: new THREE.Vector3(p.x, p.y, p.z), yaw: p.yaw || 0 });
  setStatus(`онлайн · игроков рядом: ${remotePlayers.size}`);
}
function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.mesh);
  rp.mesh.material.dispose();
  remotePlayers.delete(id);
  setStatus(`онлайн · игроков рядом: ${remotePlayers.size}`);
}
function updateRemotePlayers(dt) {
  const k = 1 - Math.pow(0.0001, dt);
  const tmp = new THREE.Vector3();
  for (const rp of remotePlayers.values()) {
    tmp.set(rp.target.x, rp.target.y + PLAYER.height / 2, rp.target.z);
    rp.mesh.position.lerp(tmp, k);
    rp.mesh.rotation.y += (rp.yaw - rp.mesh.rotation.y) * k;
  }
}

const net = new Network(SERVER_URL);

// --- Общие игровые события (сервер онлайн / локальный движок оффлайн) ---
const EVENTS = {
  blockUpdate: (m) => { if (world) world.setBlock(m.x, m.y, m.z, m.t).forEach(remeshChunk); },
  projSpawn: (m) => {
    const mat = new THREE.MeshBasicMaterial({
      color: m.kind === 'meteor' ? 0xff6622 : (PROJ_COLORS[m.kind] || 0xffffff),
    });
    const mesh = new THREE.Mesh(projGeo, mat);
    mesh.scale.setScalar(m.scale || 1);
    mesh.position.set(m.x, m.y, m.z);
    scene.add(mesh);
    projectiles.set(m.id, {
      mesh, vel: new THREE.Vector3(m.vx, m.vy, m.vz), gravity: m.gravity, kind: m.kind,
    });
  },
  projEnd: (m) => {
    const pr = projectiles.get(m.id);
    if (!pr) return;
    scene.remove(pr.mesh); pr.mesh.material.dispose(); projectiles.delete(m.id);
    spawnParticles(m.x, m.y, m.z, 0xffaa44, 12, 4, 0.5);
  },
  explosion: (m) => {
    spawnParticles(m.x, m.y, m.z, 0xff8833, 25 * m.r, 5 + 2 * m.r, 0.9);
    spawnParticles(m.x, m.y, m.z, 0x555555, 15 * m.r, 3 + m.r, 1.4);
  },
  beam: (m) => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(m.x0, m.y0, m.z0), new THREE.Vector3(m.x1, m.y1, m.z1)]);
    spawnTransient(new THREE.Line(geo,
      new THREE.LineBasicMaterial({ color: PROJ_COLORS[m.kind] || 0xffd34d, transparent: true })), 0.25);
  },
  nova: (m) => {
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff, wireframe: true, transparent: true }));
    ring.position.set(m.x, m.y + 1, m.z);
    spawnTransient(ring, 0.4, 18);
  },
  mineSpawn: (m) => {
    const mine = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshLambertMaterial({ color: 0x3a2050, emissive: 0x603a80 }));
    mine.position.set(m.x, m.y + 0.3, m.z);
    scene.add(mine);
    mineMeshes.set(m.id, mine);
  },
  mineEnd: (m) => {
    const mesh = mineMeshes.get(m.id);
    if (mesh) {
      scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();
      mineMeshes.delete(m.id);
    }
  },
  teleport: (m) => {
    if (m.id === myId || m.id === 'me') {
      player.pos.set(m.x, m.y, m.z);
      player.vel.set(0, 0, 0);
    } else {
      const rp = remotePlayers.get(m.id);
      if (rp) rp.target.set(m.x, m.y, m.z);
    }
  },
  teleportFx: (m) => {
    spawnParticles(m.x0, m.y0, m.z0, 0x9050c0, 20, 3, 0.7);
    spawnParticles(m.x1, m.y1, m.z1, 0x9050c0, 20, 3, 0.7);
  },
};
for (const [t, f] of Object.entries(EVENTS)) net.on(t, f);

net.on('init', (m) => {
  myId = m.id;
  startWorld(m.seed, m.edits);
  for (const p of m.players) addRemotePlayer(p.id, p);
  if (m.snapshot) {
    for (const pr of m.snapshot.projectiles) EVENTS.projSpawn(pr);
    for (const mn of m.snapshot.mines) EVENTS.mineSpawn(mn);
  }
  setStatus(`онлайн · игроков рядом: ${remotePlayers.size}`);
});
net.on('join',  (m) => addRemotePlayer(m.id, { x: 0.5, y: 80, z: 0.5, yaw: 0 }));
net.on('leave', (m) => removeRemotePlayer(m.id));
net.on('move',  (m) => {
  const rp = remotePlayers.get(m.id);
  if (rp) { rp.target.set(m.x, m.y, m.z); rp.yaw = m.yaw; }
});
net.on('hp', (m) => {
  if (m.id === myId) { stats.hp = m.hp; renderStats(); }
  else {
    const rp = remotePlayers.get(m.id);
    if (rp) {
      rp.mesh.material.emissive = new THREE.Color(0xff0000);
      setTimeout(() => rp.mesh.material.emissive.setHex(0x000000), 150);
    }
  }
});
net.on('mana', (m) => { stats.mana = m.mana; renderStats(); });
net.on('effects', (m) => {
  activeEffects.clear();
  for (const it of m.list) activeEffects.set(it.e, { until: it.until, power: it.power });
});
net.on('damaged', (m) => {
  stats.hp = m.hp; renderStats(); damageFlash();
  const kb = m.kb ?? 8;
  if (kb > 0) {
    const dir = new THREE.Vector3(player.pos.x - m.ax, 0, player.pos.z - m.az).normalize();
    player.knock.addScaledVector(dir, kb);
    player.vel.y += 4;
  }
});
net.on('respawn', (m) => {
  if (m.id !== myId) return;
  stats.hp = 20; renderStats();
  activeEffects.clear();
  
  // Попытка найти безопасное место до 10 раз
  let attempts = 0;
  let foundSpot = false;
  let spawnX = 0, spawnZ = 0, spawnY = 0;
  
  while (!foundSpot && attempts < 20) {
    // Случайная позиция в радиусе 100 блоков
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 100;
    spawnX = Math.cos(angle) * radius;
    spawnZ = Math.sin(angle) * radius;
    
    // Проверяем высоту и безопасность
    const terrainY = world.terrainHeight(spawnX, spawnZ);
    const checkX = Math.floor(spawnX);
    const checkZ = Math.floor(spawnZ);
    
    // Проверяем 3 блока вверх для места под игрока
    let safe = true;
    for (let y = terrainY; y < terrainY + 2; y++) {
      if (world.getBlock(checkX, y, checkZ) !== 0) {
        safe = false;
        break;
      }
    }
    
    // Проверяем, что под ногами не пустота
    const groundBlock = world.getBlock(checkX, terrainY - 1, checkZ);
    if (safe && groundBlock !== 0 && terrainY > 0) {
      spawnY = terrainY;
      foundSpot = true;
    }
    
    attempts++;
  }
  
  // Если не нашли безопасное место, спавнимся на 0,0
  if (!foundSpot) {
    spawnX = 0;
    spawnZ = 0;
    spawnY = world.terrainHeight(0, 0);
    console.warn("Could not find safe respawn location, using 0,0");
  }
  
  player.pos.set(spawnX + 0.5, spawnY, spawnZ + 0.5);
  player.vel.set(0, 0, 0);
  player.knock.set(0, 0, 0);
  
  console.log(`Respawned at (${spawnX.toFixed(2)}, ${spawnY}, ${spawnZ.toFixed(2)}) after ${attempts} attempts`);
});
net.on('disconnect', () => {
  if (!world) startWorld(Math.random() * 10000);
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
  setStatus('оффлайн (одиночная игра)');
});

// ========== Оффлайн-магия ==========
let localMagic = null;
function makeLocalCtx() {
  return {
    getBlock: (x, y, z) => world.getBlock(x, y, z),
    setBlock: (x, y, z, t) => world.setBlock(x, y, z, t).forEach(remeshChunk),
    terrainHeight: (x, z) => world.terrainHeight(x, z),
    getPlayers: () => [['me', { x: player.pos.x, y: player.pos.y, z: player.pos.z }]],
    applyDamage: (id, dmg, src) => {
      stats.hp -= dmg; renderStats(); damageFlash();
      if (src.kb > 0) {
        const d = new THREE.Vector3(player.pos.x - src.ax, 0, player.pos.z - src.az).normalize();
        player.knock.addScaledVector(d, src.kb);
        player.vel.y += 4;
      }
      if (stats.hp <= 0) {
        stats.hp = 20; activeEffects.clear(); renderStats();
        player.pos.set(0.5, world.terrainHeight(0, 0) + 1, 0.5);
      }
    },
    addEffect: (id, type, dur, power) =>
      activeEffects.set(type, { until: Date.now() + dur * 1000, power: power?.power ?? power }),
    healPlayer: (id, a) => {
      if (effectActive('curse')) return;
      stats.hp = Math.min(20, stats.hp + a); renderStats();
    },
    clearDebuffs: () => { for (const b of ['burning', 'slow', 'freeze', 'curse']) activeEffects.delete(b); },
    getMana: () => stats.mana,
    spendMana: (id, c) => { stats.mana -= c; renderStats(); },
    teleportPlayer: (id, x, y, z) => { player.pos.set(x, y, z); player.vel.set(0, 0, 0); },
    emit: (t, d) => EVENTS[t]?.(d),
  };
}

function castSpell() {
  if (!spellQueue.length) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  if (net.connected) {
    net.send('cast', { elements: [...spellQueue], dir: [dir.x, dir.y, dir.z] });
  } else {
    if (!localMagic) localMagic = createMagicEngine(makeLocalCtx());
    localMagic.cast('me', [...spellQueue], [dir.x, dir.y, dir.z],
      { x: camera.position.x, y: camera.position.y, z: camera.position.z }, yaw);
  }
  spellQueue.length = 0;
  refreshQueueUI();
}

// ========== Троттлинг позиции ==========
let lastSent = 0, lastYawSent = 0;
const lastPosSent = new THREE.Vector3(Infinity, 0, 0);
function syncPosition(now) {
  if (!net.connected || myId === null) return;
  if (now - lastSent < 100) return;
  if (lastPosSent.distanceToSquared(player.pos) < 0.0004 &&
      Math.abs(yaw - lastYawSent) < 0.01) return;
  lastSent = now;
  lastPosSent.copy(player.pos);
  lastYawSent = yaw;
  net.send('move', {
    x: +player.pos.x.toFixed(2), y: +player.pos.y.toFixed(2),
    z: +player.pos.z.toFixed(2), yaw: +yaw.toFixed(2),
  });
}

// ========== Управление ==========
renderer.domElement.addEventListener('click', () => {
  if (!invOpen) renderer.domElement.requestPointerLock();
});
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  yaw   -= e.movementX * SENS;
  pitch -= e.movementY * SENS;
  const lim = Math.PI / 2 - 0.01;
  pitch = Math.max(-lim, Math.min(lim, pitch));
});

const keys = new Set();
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyE') { toggleInventory(); return; }
  if (invOpen) return;
  if (e.code === 'KeyQ') {
    combatMode = !combatMode;
    spellQueue.length = 0;
    refreshQueueUI();
    ringEl.classList.toggle('combat', combatMode);
    return;
  }
  if (e.code === 'KeyX' && combatMode) { spellQueue.length = 0; refreshQueueUI(); return; }
  keys.add(e.code);
  if (e.code === 'KeyF') { player.flying = !player.flying; player.vel.set(0, 0, 0); }
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= 9) {
      if (combatMode) addElement(n - 1);
      else { selectedSlot = n - 1; refreshUI(); }
    }
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
document.addEventListener('wheel', (e) => {
  if (invOpen || combatMode) return;
  selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
  refreshUI();
});

// ========== Физика ==========
function moveAxis(dt, axis) {
  player.pos[axis] += player.vel[axis] * dt;
  const half = PLAYER.width / 2, E = 1e-4;
  const min = { x: player.pos.x - half, y: player.pos.y,                 z: player.pos.z - half };
  const max = { x: player.pos.x + half, y: player.pos.y + PLAYER.height, z: player.pos.z + half };

  for (let y = Math.floor(min.y); y <= Math.floor(max.y - E); y++)
    for (let x = Math.floor(min.x); x <= Math.floor(max.x - E); x++)
      for (let z = Math.floor(min.z); z <= Math.floor(max.z - E); z++) {
        if (world.getBlock(x, y, z) === AIR) continue;
        const v = player.vel[axis];
        if (axis === 'y') {
          if (v < 0) { player.pos.y = y + 1; player.onGround = true; }
          else       { player.pos.y = y - PLAYER.height; }
        } else if (axis === 'x') {
          player.pos.x = v > 0 ? x - half - E : x + 1 + half + E;
        } else {
          player.pos.z = v > 0 ? z - half - E : z + 1 + half + E;
        }
        player.vel[axis] = 0;
        return;
      }
}

function updatePlayer(dt) {
  camera.rotation.set(pitch, yaw, 0);

  let speedMul = 1;
  const sp = effectActive('speed');
  if (sp) speedMul *= sp.power;
  if (effectActive('slow'))   speedMul *= 0.5;
  if (effectActive('freeze')) speedMul = 0;

  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));
  const wish = new THREE.Vector3();
  if (keys.has('KeyW')) wish.add(forward);
  if (keys.has('KeyS')) wish.sub(forward);
  if (keys.has('KeyD')) wish.add(right);
  if (keys.has('KeyA')) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize();

  if (player.flying) {
    if (keys.has('Space'))     wish.y += 1;
    if (keys.has('ShiftLeft')) wish.y -= 1;
    player.pos.addScaledVector(wish, FLY_SPEED * speedMul * dt);
  } else {
    player.vel.x = wish.x * WALK_SPEED * speedMul + player.knock.x;
    player.vel.z = wish.z * WALK_SPEED * speedMul + player.knock.z;
    const decay = Math.pow(0.03, dt);
    player.knock.x *= decay;
    player.knock.z *= decay;

    if (effectActive('levitate')) {
      player.vel.y = keys.has('Space') ? 4 : keys.has('ShiftLeft') ? -4 : 0;
    } else {
      player.vel.y -= GRAVITY * dt;
      if (keys.has('Space') && player.onGround && speedMul > 0) player.vel.y = JUMP_SPEED;
    }
    player.onGround = false;
    moveAxis(dt, 'y');
    moveAxis(dt, 'x');
    moveAxis(dt, 'z');
  }

  if (player.pos.y < -30) {
    player.pos.set(0.5, world.terrainHeight(0, 0) + 1, 0.5);
    player.vel.set(0, 0, 0);
    player.knock.set(0, 0, 0);
  }
  camera.position.set(player.pos.x, player.pos.y + PLAYER.eye, player.pos.z);
}

// ========== Райкасты ==========
function raycastBlock(maxDist = 5) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const p = camera.position;
  let prev = null;
  for (let t = 0; t < maxDist; t += 0.02) {
    const bx = Math.floor(p.x + dir.x * t);
    const by = Math.floor(p.y + dir.y * t);
    const bz = Math.floor(p.z + dir.z * t);
    if (world.getBlock(bx, by, bz) !== AIR) return { block: [bx, by, bz], prev, dist: t };
    prev = [bx, by, bz];
  }
  return null;
}

const playerRaycaster = new THREE.Raycaster();
function raycastPlayers(maxDist) {
  if (!remotePlayers.size) return null;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  playerRaycaster.set(camera.position, dir);
  playerRaycaster.far = maxDist;
  let best = null;
  for (const [id, rp] of remotePlayers) {
    const hits = playerRaycaster.intersectObject(rp.mesh);
    if (hits.length && (!best || hits[0].distance < best.dist))
      best = { id, dist: hits[0].distance };
  }
  return best;
}

function intersectsPlayer(bx, by, bz) {
  const half = PLAYER.width / 2;
  return bx + 1 > player.pos.x - half && bx < player.pos.x + half &&
         by + 1 > player.pos.y        && by < player.pos.y + PLAYER.height &&
         bz + 1 > player.pos.z - half && bz < player.pos.z + half;
}

// ========== Инвентарь ==========
const INV_SIZE = 36;
const inventory = new Array(INV_SIZE).fill(null);
let selectedSlot = 0, held = null, invOpen = false;

function addItem(type) {
  let slot = inventory.find(s => s && s.type === type && s.count < 64);
  if (slot) { slot.count++; refreshUI(); return; }
  const i = inventory.findIndex(s => s === null);
  if (i !== -1) { inventory[i] = { type, count: 1 }; refreshUI(); }
}

function renderSlot(el, slot) {
  el.innerHTML = '';
  if (!slot) return;
  const sw = document.createElement('div');
  sw.className = 'swatch';
  sw.style.background = '#' + BLOCK_COLORS[slot.type].getHexString();
  const cnt = document.createElement('div');
  cnt.className = 'count';
  cnt.textContent = slot.count;
  el.append(sw, cnt);
}

const hotbarEl = document.getElementById('hotbar');
const hudSlots = [];
for (let i = 0; i < 9; i++) {
  const el = document.createElement('div');
  el.className = 'slot';
  hotbarEl.appendChild(el);
  hudSlots.push(el);
}

const invEl = document.getElementById('inventory');
const invSlots = [];
function makeInvSlot(index, container) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.addEventListener('mousedown', (e) => { e.preventDefault(); clickSlot(index, e.button); });
  container.appendChild(el);
  invSlots[index] = el;
}
for (let i = 9; i < 36; i++) makeInvSlot(i, document.getElementById('inv-main'));
for (let i = 0; i < 9; i++)  makeInvSlot(i, document.getElementById('inv-hotbar-row'));

function clickSlot(i, button) {
  const slot = inventory[i];
  if (button === 0) {
    if (!held && slot) { held = slot; inventory[i] = null; }
    else if (held && !slot) { inventory[i] = held; held = null; }
    else if (held && slot && slot.type === held.type) {
      const move = Math.min(64 - slot.count, held.count);
      slot.count += move; held.count -= move;
      if (held.count <= 0) held = null;
    } else if (held && slot) { inventory[i] = held; held = slot; }
  } else if (button === 2) {
    if (!held && slot) {
      const take = Math.ceil(slot.count / 2);
      held = { type: slot.type, count: take };
      slot.count -= take;
      if (slot.count <= 0) inventory[i] = null;
    } else if (held && !slot) {
      inventory[i] = { type: held.type, count: 1 };
      if (--held.count <= 0) held = null;
    } else if (held && slot && slot.type === held.type && slot.count < 64) {
      slot.count++;
      if (--held.count <= 0) held = null;
    }
  }
  refreshUI();
}

const heldEl = document.getElementById('held-item');
document.addEventListener('mousemove', (e) => {
  if (!held) return;
  heldEl.style.left = e.clientX - 18 + 'px';
  heldEl.style.top  = e.clientY - 18 + 'px';
});

function refreshUI() {
  for (let i = 0; i < 9; i++) {
    renderSlot(hudSlots[i], inventory[i]);
    hudSlots[i].classList.toggle('selected', i === selectedSlot);
  }
  for (let i = 0; i < 36; i++) renderSlot(invSlots[i], inventory[i]);
  heldEl.style.display = held ? 'block' : 'none';
  if (held) {
    heldEl.style.background = '#' + BLOCK_COLORS[held.type].getHexString();
    heldEl.querySelector('.count').textContent = held.count;
  }
}
refreshUI();

function toggleInventory() {
  invOpen = !invOpen;
  invEl.classList.toggle('open', invOpen);
  if (invOpen) {
    document.exitPointerLock();
    keys.clear();
  } else {
    if (held) {
      for (let n = held.count; n > 0; n--) addItem(held.type);
      held = null;
    }
    renderer.domElement.requestPointerLock();
  }
  refreshUI();
}
invEl.addEventListener('contextmenu', (e) => e.preventDefault());

// ========== Действия мыши ==========
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => {
  if (!world || document.pointerLockElement !== renderer.domElement) return;

  if (combatMode) {
    if (e.button === 0) {
      if (spellQueue.length) castSpell();
      else {
        const t = raycastPlayers(4.5);
        if (t) net.send('attack', { target: t.id });
      }
    } else if (e.button === 2) {
      spellQueue.pop();
      refreshQueueUI();
    }
    return;
  }

  const hit = raycastBlock(5);
  if (e.button === 0) {
    const target = raycastPlayers(4.5);
    if (target && (!hit || target.dist < hit.dist)) {
      net.send('attack', { target: target.id });
      return;
    }
    if (!hit) return;
    const [x, y, z] = hit.block;
    addItem(world.getBlock(x, y, z));
    world.setBlock(x, y, z, AIR).forEach(remeshChunk);
    net.send('setBlock', { x, y, z, t: AIR });
  } else if (e.button === 2 && hit?.prev) {
    const slot = inventory[selectedSlot];
    if (!slot) return;
    const [x, y, z] = hit.prev;
    if (intersectsPlayer(x, y, z)) return;
    world.setBlock(x, y, z, slot.type).forEach(remeshChunk);
    net.send('setBlock', { x, y, z, t: slot.type });
    if (--slot.count <= 0) inventory[selectedSlot] = null;
    refreshUI();
  }
});

// ========== Игровой цикл ==========
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (world) {
    const ready = world.getChunk(
      Math.floor(player.pos.x / CHUNK_SIZE),
      Math.floor(player.pos.z / CHUNK_SIZE));
    if (ready) updatePlayer(dt);
    updateRemotePlayers(dt);

    for (const pr of projectiles.values()) {
      if (pr.gravity || pr.kind === 'meteor') pr.vel.y -= (pr.kind === 'meteor' ? 10 : 20) * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      spawnParticles(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z,
        pr.kind === 'meteor' ? 0xff6622 : 0xffcc88, 1, 0.6, 0.35);
    }

    if (!net.connected) {
      if (localMagic) localMagic.tick(dt);
      stats.mana = Math.min(stats.maxMana, stats.mana + dt);
      const burn = effectActive('burning');
      if (burn) {
        burnAcc += dt;
        if (burnAcc >= 1) { burnAcc -= 1; stats.hp -= burn.power; renderStats(); damageFlash(); }
      }
      renderStats();
    }

    updateTransients(dt);
    updateParticles(dt);
    syncPosition(now);
    renderEffects(now);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
