import * as THREE from 'three';
import { World, buildChunkMesh, buildLODMesh, AIR, BLOCK_COLORS, CHUNK_SIZE,
         GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, SAND, GRAVEL, COAL_ORE, IRON_ORE } from './world.js';
import { Network } from './network.js';
import { createMagicEngine } from './magic.js';
import { initParticles, spawnParticles, updateParticles } from './particles.js';

// ========== Данные заклинаний ==========
const SPELLS = [
  { name: "Прыгучесть", elements: "air + air + earth", effect: "+50% высоты прыжка на 75 сек" },
  { name: "Регенерация", elements: "water + light + light", effect: "1 HP/сек на 50 сек" },
  { name: "Огнеупорность", elements: "fire + earth + shield", effect: "50% сопротивления огню на 100 сек" },
  { name: "Огненная аура", elements: "fire + fire + air", effect: "1 урон/сек врагам в радиусе 3 на 60 сек" },
  { name: "Ледяная кожа", elements: "ice + ice + earth", effect: "замедление атакующих на 2 сек (75 сек)" },
  { name: "Разряд", elements: "beam + fire + air", effect: "20% шанс молнии при атаке (40 сек)" },
  { name: "Невесомость", elements: "air + air + light", effect: "медленное падение + двойной прыжок (50 сек)" },
  { name: "Барьер", elements: "shield + earth", effect: "щит на 4 ед. поглощения (75 сек)" },
  { name: "Каменная кожа", elements: "shield + ice", effect: "+ броня на 8 сек" },
  { name: "Лечение", elements: "light + light", effect: "снимает дебаффы, лечит 3*кол-во света" },
  { name: "Ускорение", elements: "air + air", effect: "+60% скорости на 3+2*n(air) сек" },
  { name: "Левитация", elements: "air + light", effect: "медленное парение" },
  { name: "Ослепление", elements: "light + water + air", effect: "слепота врагов в радиусе 5 (15 сек)" },
  { name: "Теневой шаг", elements: "dark + dark + air", effect: "телепорт за спину ближайшему игроку" },
  { name: "Цепочка послушания", elements: "dark + beam + fire", effect: "связывает врагов, передача 50% урона" },
  { name: "Обмен местами", elements: "dark + air + earth", effect: "меняется позициями с ближайшим игроком" },
  { name: "Мина", elements: "shield + dark", effect: "ставит мину, взрыв при приближении врага" },
  { name: "Телепортация", elements: "air + dark", effect: "телепорт в направлении взгляда" },
  { name: "Сфера защиты", elements: "shield + earth + air + water + light", effect: "непробиваемая сфера" },
  { name: "Астероид", elements: "fire + earth + dark + beam + air", effect: "падающий камень, взрыв" },
  { name: "Вечный лёд", elements: "ice + water + earth + dark + light", effect: "зона замедления времени" },
  { name: "Феникс", elements: "fire + light + air + earth + shield", effect: "возрождение при HP<4 (1 раз)" },
  { name: "Громокаменный топот", elements: "earth + air + fire + beam + shield", effect: "ударная волна" },
  { name: "Чёрный вихрь", elements: "dark + air + water + earth + beam", effect: "торнадо" },
  { name: "Световая клетка", elements: "light + beam + air + earth + fire", effect: "клетка с разрядами" },
  { name: "Теневые оковы", elements: "dark + ice + earth + air + water", effect: "враг не поворачивается" },
  { name: "Дыхание дракона", elements: "fire + dark + air + earth + ice", effect: "конусный выдох" },
  { name: "Электрический тотем", elements: "earth + beam + air", effect: "тотем ускорения" },
  { name: "Метеор", elements: "beam + fire + earth", effect: "падающий взрывной снаряд" },
];

// ========== Инициализация рендера ==========
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
initParticles(scene);
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 400, 1400);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1500);
camera.rotation.order = 'YXZ';

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

scene.add(new THREE.DirectionalLight(0xffffff, 1.0).position.set(1, 2, 0.5));
scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// ========== Настройки мыши ==========
const SENS_KEY = 'voxel_sensitivity';
let currentSens = parseFloat(localStorage.getItem(SENS_KEY)) || 0.002;
let SENS = currentSens;
let settingsOpen = false;
let settingsMenu = null;

function createSettingsMenu() {
  if (settingsMenu) return;
  settingsMenu = document.createElement('div');
  settingsMenu.id = 'settings-menu';
  settingsMenu.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:300px;background:rgba(30,30,40,0.95);border:2px solid #aaa;border-radius:8px;
    padding:20px;color:white;font-family:monospace;display:none;flex-direction:column;gap:15px;z-index:200;`;
  const title = document.createElement('h3');
  title.textContent = 'Настройки';
  const sensLabel = document.createElement('label');
  const range = document.createElement('input');
  range.type = 'range';
  range.min = 0.5; range.max = 5; range.step = 0.05;
  range.value = currentSens * 1000;
  const updateSens = () => {
    currentSens = range.value / 1000;
    SENS = currentSens;
    localStorage.setItem(SENS_KEY, currentSens);
    sensLabel.textContent = `Чувствительность: ${range.value}`;
  };
  range.addEventListener('input', updateSens);
  sensLabel.appendChild(range);
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Закрыть (Esc)';
  closeBtn.onclick = () => toggleSettings(false);
  settingsMenu.append(title, sensLabel, closeBtn);
  document.body.appendChild(settingsMenu);
  updateSens();
}

function toggleSettings(open) {
  settingsOpen = open;
  if (settingsMenu) settingsMenu.style.display = open ? 'flex' : 'none';
  if (open) {
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    if (chatInput) chatInput.blur();
    keys.clear();
    if (spellBookOpen) closeSpellBook();
  } else if (!invOpen && !chatFocused && document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
  }
}

// ========== Книга заклинаний ==========
let spellBookOpen = false, spellBookElem = null, spellBookContent = null, currentPage = 0;
const SPELLS_PER_PAGE = 8;

function renderSpellBook() {
  if (!spellBookContent) return;
  const start = currentPage * SPELLS_PER_PAGE;
  const end = Math.min(start + SPELLS_PER_PAGE, SPELLS.length);
  let html = '<div style="display:flex;flex-direction:column;gap:8px;">';
  for (let i = start; i < end; i++) {
    const s = SPELLS[i];
    html += `<div><b>${s.name}</b><br><span style="color:#ffaa66;">${s.elements}</span><br><span style="font-size:12px;">${s.effect}</span></div><hr>`;
  }
  html += `<div style="text-align:center;">Страница ${currentPage+1} из ${Math.ceil(SPELLS.length/SPELLS_PER_PAGE)}</div>`;
  spellBookContent.innerHTML = html;
}

function openSpellBook() {
  if (spellBookOpen) return;
  spellBookOpen = true;
  if (!spellBookElem) {
    spellBookElem = document.createElement('div');
    spellBookElem.id = 'spell-book';
    spellBookElem.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
      width:500px;max-height:80%;background:rgba(20,20,30,0.95);border:2px solid #c9a87b;
      border-radius:12px;padding:16px;color:#f0e6d0;font-family:monospace;z-index:1000;
      display:flex;flex-direction:column;backdrop-filter:blur(8px);`;
    spellBookElem.innerHTML = '<h2 style="text-align:center;">📖 Книга заклинаний</h2>';
    spellBookContent = document.createElement('div');
    spellBookContent.style.overflowY = 'auto';
    spellBookElem.appendChild(spellBookContent);
    const nav = document.createElement('div');
    nav.style.display = 'flex'; nav.style.justifyContent = 'space-between'; nav.style.marginTop = '12px';
    const prevBtn = document.createElement('button'); prevBtn.textContent = '◀ Назад';
    prevBtn.onclick = () => { if (currentPage > 0) { currentPage--; renderSpellBook(); } };
    const nextBtn = document.createElement('button'); nextBtn.textContent = 'Вперед ▶';
    nextBtn.onclick = () => { if ((currentPage+1)*SPELLS_PER_PAGE < SPELLS.length) { currentPage++; renderSpellBook(); } };
    const closeBtn = document.createElement('button'); closeBtn.textContent = 'Закрыть (Esc)';
    closeBtn.onclick = closeSpellBook;
    nav.append(prevBtn, closeBtn, nextBtn);
    spellBookElem.appendChild(nav);
    document.body.appendChild(spellBookElem);
  }
  renderSpellBook();
  spellBookElem.style.display = 'flex';
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  keys.clear();
}

function closeSpellBook() {
  if (!spellBookOpen) return;
  spellBookOpen = false;
  if (spellBookElem) spellBookElem.style.display = 'none';
  if (!invOpen && !settingsOpen && !chatFocused) renderer.domElement.requestPointerLock();
}

// ========== Игрок и физика ==========
const PLAYER = { width: 0.6, height: 1.8, eye: 1.62 };
const GRAVITY = 28, JUMP_SPEED = 9, WALK_SPEED = 5, FLY_SPEED = 12;
const player = {
  pos: new THREE.Vector3(0.5, 80, 0.5),
  vel: new THREE.Vector3(),
  knock: new THREE.Vector3(),
  onGround: false,
  flying: false,
  doubleJumpUsed: false,
};
let yaw = 0, pitch = 0;

// ========== Мир и чанки ==========
let world = null;
const FULL_RADIUS = 9, FULL_BUDGET = 8, LOD_BUDGET = 6;
const LOD_RINGS = [{ level: 2, radius: 20 }, { level: 3, radius: 48 }];
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

  // Полные чанки
  const wantFull = new Set(), missing = [];
  for (let dx = -FULL_RADIUS; dx <= FULL_RADIUS; dx++)
    for (let dz = -FULL_RADIUS; dz <= FULL_RADIUS; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      wantFull.add(world.key(cx, cz));
      if (!world.getChunk(cx, cz)) missing.push([cx, cz, dx*dx+dz*dz]);
    }
  missing.sort((a,b)=>a[2]-b[2]);
  for (const [cx, cz] of missing.slice(0, FULL_BUDGET)) {
    remeshChunk(world.generateChunk(cx, cz));
    for (const [nx, nz] of [[cx+1,cz],[cx-1,cz],[cx,cz+1],[cx,cz-1]]) {
      const nb = world.getChunk(nx, nz);
      if (nb?.mesh) remeshChunk(nb);
    }
  }
  for (const [key, c] of world.chunks) {
    if (!wantFull.has(key)) {
      if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
      world.chunks.delete(key);
    }
  }

  // LOD чанки
  const wantLod = new Set(), lodMissing = [];
  let inner = FULL_RADIUS;
  for (const { level, radius } of LOD_RINGS) {
    const s = 1 << level;
    for (let gx = Math.floor((pcx-radius)/s); gx <= Math.floor((pcx+radius)/s); gx++)
      for (let gz = Math.floor((pcz-radius)/s); gz <= Math.floor((pcz+radius)/s); gz++) {
        const d = Math.max(Math.abs(gx*s + s/2 - pcx), Math.abs(gz*s + s/2 - pcz));
        if (d > radius || d <= inner) continue;
        const key = `${level}:${gx},${gz}`;
        wantLod.add(key);
        if (!lodMeshes.has(key)) lodMissing.push([key, gx, gz, level, d]);
      }
    inner = radius;
  }
  lodMissing.sort((a,b)=>a[4]-b[4]);
  for (const [key, gx, gz, level] of lodMissing.slice(0, LOD_BUDGET)) {
    const mesh = buildLODMesh(world, gx, gz, level);
    lodMeshes.set(key, mesh);
    scene.add(mesh);
  }
  for (const [key, mesh] of lodMeshes) {
    if (!wantLod.has(key)) {
      scene.remove(mesh); mesh.geometry.dispose(); lodMeshes.delete(key);
    }
  }
}
setInterval(chunkManagerTick, 250);

// ========== Статы и эффекты ==========
const stats = { hp: 50, armor: 0, mana: 20, maxMana: 20 };
const activeEffects = new Map();
let burnAcc = 0;

const heartsEl = document.getElementById('hearts');
const manaFill = document.getElementById('mana-fill');
const flashEl = document.getElementById('damage-flash');
const effectsEl = document.getElementById('effects-hud');

function renderStats() {
  let s = '';
  for (let i = 0; i < 25; i++) s += `<span style="color:${stats.hp >= i*2+1 ? '#e33' : '#444'}">❤</span>`;
  s += '  ';
  for (let i = 0; i < 5; i++) s += `<span style="color:${stats.armor >= i*4+4 ? '#ccc' : '#444'}">🛡</span>`;
  heartsEl.innerHTML = s;
  manaFill.style.width = (Math.max(0, stats.mana) / stats.maxMana * 100) + '%';
}
renderStats();

function damageFlash() {
  flashEl.style.transition = 'none';
  flashEl.style.opacity = 1;
  requestAnimationFrame(() => { flashEl.style.transition = 'opacity 0.4s'; flashEl.style.opacity = 0; });
}

function effectActive(name) {
  const e = activeEffects.get(name);
  return e && e.until > Date.now() ? e : null;
}

function renderEffects(now) {
  if (!effectsEl) return;
  let html = '';
  for (const [e, v] of activeEffects) {
    if (v.until < Date.now()) activeEffects.delete(e);
    else html += `${e} ${Math.ceil((v.until-Date.now())/1000)}с${e==='ward'?` (${v.power})`:''}<br>`;
  }
  effectsEl.innerHTML = html;
}

// ========== Магия: кольцо элементов ==========
const ELEMENTS = [
  { id: 'fire', icon: '🔥', color: '#f4502a' }, { id: 'water', icon: '💧', color: '#3a6cf4' },
  { id: 'air', icon: '💨', color: '#9fd8ef' }, { id: 'earth', icon: '🪨', color: '#8b5a2b' },
  { id: 'beam', icon: '⚡', color: '#ffd34d' }, { id: 'ice', icon: '❄', color: '#9ff' },
  { id: 'shield', icon: '🛡', color: '#9a9' }, { id: 'light', icon: '☀', color: '#ffe9a0' },
  { id: 'dark', icon: '🌑', color: '#603a80' }
];
const CONFLICTS = [['fire','water'], ['fire','ice'], ['light','dark']];
let combatMode = false;
const spellQueue = [];

const ringEl = document.getElementById('magic-ring');
const queueEl = document.getElementById('spell-queue');
const iconEls = [];
ELEMENTS.forEach((el, i) => {
  const a = -Math.PI/2 + i * 2*Math.PI/9;
  const d = document.createElement('div');
  d.className = 'element-icon';
  d.style.cssText = `left:${Math.cos(a)*70}px;top:${Math.sin(a)*70}px;background:${el.color}55;`;
  d.innerHTML = `${el.icon}<span class="num">${i+1}</span>`;
  ringEl.appendChild(d);
  iconEls.push(d);
});

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
  if (CONFLICTS.some(([a,b]) => (id===a && spellQueue.includes(b)) || (id===b && spellQueue.includes(a)))) return;
  spellQueue.push(id);
  iconEls[i].classList.add('flash');
  setTimeout(() => iconEls[i].classList.remove('flash'), 200);
  refreshQueueUI();
}

// ========== Визуальные эффекты (снаряды, мины и т.д.) ==========
const PROJ_COLORS = { fire:0xf4502a, water:0x3a6cf4, air:0xbfe8ff, earth:0x8b5a2b, ice:0x9ff5ff, dark:0x603a80, light:0xffe9a0, beam:0xffd34d };
const projGeo = new THREE.SphereGeometry(0.25, 8, 6);
const projectiles = new Map();
const mineMeshes = new Map();
const transients = [];

function spawnTransient(mesh, life, grow=0) {
  scene.add(mesh);
  transients.push({ mesh, life, maxLife: life, grow });
}

function updateTransients(dt) {
  for (let i=transients.length-1; i>=0; i--) {
    const t = transients[i];
    t.life -= dt;
    if (t.grow) t.mesh.scale.addScalar(t.grow * dt);
    if (t.mesh.material.opacity !== undefined) t.mesh.material.opacity = Math.max(0, t.life/t.maxLife);
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      if (t.mesh.material) t.mesh.material.dispose();
      transients.splice(i,1);
    }
  }
}

// ========== Сеть и удалённые игроки ==========
const SERVER_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
let myId = null;
const remotePlayers = new Map();

function createPlayerModel(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.5, metalness:0.1 });
  const legGeo = new THREE.BoxGeometry(0.3,0.6,0.3);
  const leftLeg = new THREE.Mesh(legGeo,mat); leftLeg.position.set(-0.2,0.3,0);
  const rightLeg = new THREE.Mesh(legGeo,mat); rightLeg.position.set(0.2,0.3,0);
  const torsoGeo = new THREE.BoxGeometry(0.6,0.8,0.3);
  const torso = new THREE.Mesh(torsoGeo,mat); torso.position.set(0,1,0);
  const armGeo = new THREE.BoxGeometry(0.3,0.6,0.3);
  const leftArm = new THREE.Mesh(armGeo,mat); leftArm.position.set(-0.45,1.1,0);
  const rightArm = new THREE.Mesh(armGeo,mat); rightArm.position.set(0.45,1.1,0);
  const headGeo = new THREE.BoxGeometry(0.5,0.5,0.5);
  const head = new THREE.Mesh(headGeo,mat); head.position.set(0,1.6,0);
  group.add(leftLeg, rightLeg, torso, leftArm, rightArm, head);
  group.userData = { leftArm, rightArm, leftLeg, rightLeg };
  return group;
}

function addRemotePlayer(id, p) {
  if (id === myId || remotePlayers.has(id)) return;
  const color = new THREE.Color().setHSL((id * 0.61) % 1, 0.7, 0.5);
  const group = createPlayerModel(color);
  group.position.set(p.x, p.y, p.z);
  scene.add(group);
  remotePlayers.set(id, {
    group, target: new THREE.Vector3(p.x,p.y,p.z), yaw: p.yaw||0,
    lastPos: new THREE.Vector3(p.x,p.y,p.z), phase: 0
  });
  document.getElementById('status').textContent = `онлайн · игроков: ${remotePlayers.size}`;
}

function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (rp) { scene.remove(rp.group); remotePlayers.delete(id); }
  document.getElementById('status').textContent = `онлайн · игроков: ${remotePlayers.size}`;
}

function updateRemotePlayers(dt) {
  const k = 1 - Math.pow(0.0001, dt);
  for (const rp of remotePlayers.values()) {
    rp.group.position.lerp(rp.target, k);
    rp.group.rotation.y += (rp.yaw - rp.group.rotation.y) * k;
    const speed = Math.hypot(rp.group.position.x - rp.lastPos.x, rp.group.position.z - rp.lastPos.z);
    if (speed > 0.01) rp.phase += speed * 12;
    else rp.phase *= 0.95;
    const angle = Math.sin(rp.phase) * 0.8;
    const legAngle = Math.sin(rp.phase) * 0.5;
    if (rp.group.userData.leftArm) rp.group.userData.leftArm.rotation.x = angle;
    if (rp.group.userData.rightArm) rp.group.userData.rightArm.rotation.x = -angle;
    if (rp.group.userData.leftLeg) rp.group.userData.leftLeg.rotation.x = -legAngle;
    if (rp.group.userData.rightLeg) rp.group.userData.rightLeg.rotation.x = legAngle;
    rp.lastPos.copy(rp.group.position);
  }
}

const net = new Network(SERVER_URL);

// Обработчики событий сети
net.on('init', (m) => {
  myId = m.id;
  startWorld(m.seed, m.edits);
  m.players.forEach(p => addRemotePlayer(p.id, p));
  if (m.snapshot) {
    m.snapshot.projectiles?.forEach(pr => EVENTS.projSpawn(pr));
    m.snapshot.mines?.forEach(mn => EVENTS.mineSpawn(mn));
  }
  m.zones?.forEach(z => EVENTS.zoneSpawn(z));
  m.timeSlowZones?.forEach(z => EVENTS.timeSlowZone(z));
});
net.on('join', m => addRemotePlayer(m.id, { x:0.5, y:80, z:0.5, yaw:0, nickname:m.nickname }));
net.on('leave', m => removeRemotePlayer(m.id));
net.on('move', m => { const rp = remotePlayers.get(m.id); if(rp) { rp.target.set(m.x,m.y,m.z); rp.yaw = m.yaw; } });
net.on('hp', (m) => {
  if (m.id === myId) { stats.hp = m.hp; renderStats(); }
  else {
    const rp = remotePlayers.get(m.id);
    if (rp) { /* flash model */ spawnParticles(rp.group.position.x, rp.group.position.y+1, rp.group.position.z, 0xff3333, 20,2,1); }
  }
});
net.on('mana', m => { stats.mana = m.mana; renderStats(); });
net.on('effects', (m) => {
  activeEffects.clear();
  m.list.forEach(it => activeEffects.set(it.e, { until: it.until, power: it.power }));
  // визуальные эффекты
  if (activeEffects.has('blind')) setBlindness(true);
  else setBlindness(false);
  if (activeEffects.has('ward') && !shieldMesh) {
    const sphereGeo = new THREE.SphereGeometry(0.8,16,16);
    shieldMesh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color:0x44aaff, transparent:true, opacity:0.3, wireframe:true }));
    shieldMesh.position.set(0,1,0);
    camera.add(shieldMesh);
  } else if (!activeEffects.has('ward') && shieldMesh) { camera.remove(shieldMesh); shieldMesh = null; }
});
net.on('damaged', (m) => {
  stats.hp = m.hp; renderStats(); damageFlash();
  spawnParticles(camera.position.x, camera.position.y-0.5, camera.position.z, 0xff4444, 15,1.5,0.8);
  if (m.kb > 0) {
    const dir = new THREE.Vector3(player.pos.x - m.ax, 0, player.pos.z - m.az).normalize();
    player.knock.addScaledVector(dir, m.kb);
    player.vel.y += 4;
  }
});
net.on('respawn', (m) => {
  if (m.id !== myId) return;
  stats.hp = 50; renderStats(); activeEffects.clear();
  const spawn = findSafeSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.vel.set(0,0,0); player.knock.set(0,0,0);
});
net.on('disconnect', () => {
  if (!world) startWorld(Math.random()*10000);
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
  document.getElementById('status').textContent = 'оффлайн (одиночная игра)';
});
net.on('systemMessage', msg => addChatMessage('Система', msg.message));
net.on('chat', msg => addChatMessage(msg.senderId===myId?'You':(msg.senderNick||`Player ${msg.senderId}`), msg.message));

// Визуальные события
const EVENTS = {
  blockUpdate: m => { if(world) world.setBlock(m.x,m.y,m.z,m.t).forEach(remeshChunk); },
  projSpawn: m => {
    const mat = new THREE.MeshBasicMaterial({ color: m.kind==='meteor'?0xff6622:(PROJ_COLORS[m.kind]||0xffffff) });
    const mesh = new THREE.Mesh(projGeo, mat);
    mesh.scale.setScalar(m.scale||1);
    mesh.position.set(m.x,m.y,m.z);
    scene.add(mesh);
    projectiles.set(m.id, { mesh, vel: new THREE.Vector3(m.vx,m.vy,m.vz), gravity: m.gravity, kind: m.kind });
  },
  projEnd: m => {
    const pr = projectiles.get(m.id);
    if(pr) { scene.remove(pr.mesh); pr.mesh.material.dispose(); projectiles.delete(m.id); spawnParticles(m.x,m.y,m.z,0xffaa44,12,4,0.5); }
  },
  explosion: m => { spawnParticles(m.x,m.y,m.z,0xff8833,25*m.r,5+2*m.r,0.9); spawnParticles(m.x,m.y,m.z,0x555555,15*m.r,3+m.r,1.4); },
  beam: m => {
    const points = [new THREE.Vector3(m.x0,m.y0,m.z0), new THREE.Vector3(m.x1,m.y1,m.z1)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    spawnTransient(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: PROJ_COLORS[m.kind]||0xffd34d, transparent:true })), 0.25);
  },
  nova: m => {
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.6,14,10), new THREE.MeshBasicMaterial({ color:0xbfe8ff, wireframe:true, transparent:true }));
    ring.position.set(m.x,m.y+1,m.z);
    spawnTransient(ring, 0.4, 18);
  },
  mineSpawn: m => {
    const mine = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6), new THREE.MeshLambertMaterial({ color:0x3a2050, emissive:0x603a80 }));
    mine.position.set(m.x,m.y+0.3,m.z);
    scene.add(mine);
    mineMeshes.set(m.id, mine);
  },
  mineEnd: m => { const mesh = mineMeshes.get(m.id); if(mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mineMeshes.delete(m.id); } },
  teleport: m => {
    if(m.id===myId || m.id==='me') { player.pos.set(m.x,m.y,m.z); player.vel.set(0,0,0); }
    else { const rp = remotePlayers.get(m.id); if(rp) rp.target.set(m.x,m.y,m.z); }
  },
  teleportFx: m => { spawnParticles(m.x0,m.y0,m.z0,0x9050c0,20,3,0.7); spawnParticles(m.x1,m.y1,m.z1,0x9050c0,20,3,0.7); },
  lightningEffect: m => {
    const from = remotePlayers.get(m.from)?.group.position || player.pos;
    const to = remotePlayers.get(m.to)?.group.position || player.pos;
    const points = [from.clone(), to.clone()];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color:0xffaa44 }));
    scene.add(line);
    setTimeout(()=>scene.remove(line),200);
    spawnParticles(to.x,to.y+1,to.z,0xffaa44,15,2,0.5);
  },
  zoneSpawn: m => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(m.radius-0.2,m.radius+0.2,32), new THREE.MeshBasicMaterial({ color:0x88ffaa, side:THREE.DoubleSide, transparent:true, opacity:0.6 }));
    ring.rotation.x = -Math.PI/2;
    ring.position.set(m.x,0.1,m.z);
    scene.add(ring);
    const interval = setInterval(() => { if(ring.parent) spawnParticles(m.x+(Math.random()-0.5)*m.radius,0.5,m.z+(Math.random()-0.5)*m.radius,0xaaffaa,3,0.5,0.3); else clearInterval(interval); }, 500);
    setTimeout(() => { scene.remove(ring); clearInterval(interval); }, (m.duration||8)*1000);
  },
  timeSlowZone: m => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(m.radius-0.2,m.radius+0.2,32), new THREE.MeshBasicMaterial({ color:0x88aaff, side:THREE.DoubleSide, transparent:true, opacity:0.5 }));
    ring.rotation.x = -Math.PI/2;
    ring.position.set(m.x,0.1,m.z);
    scene.add(ring);
    setTimeout(()=>scene.remove(ring), (m.duration||15)*1000);
  },
};
for (const [t,f] of Object.entries(EVENTS)) net.on(t,f);

let blindnessOverlay = null;
function setBlindness(active) {
  if(!blindnessOverlay) {
    blindnessOverlay = document.createElement('div');
    blindnessOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(255,255,200,0.7);pointer-events:none;z-index:1000;display:none;';
    document.body.appendChild(blindnessOverlay);
  }
  blindnessOverlay.style.display = active ? 'block' : 'none';
}
let shieldMesh = null;

// ========== Чат и координаты ==========
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
let chatFocused = false;
function addChatMessage(sender, msg) {
  const div = document.createElement('div');
  div.textContent = `${sender}: ${msg}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function findSafeSpawn() {
  for (let attempts=0; attempts<20; attempts++) {
    const angle = Math.random() * Math.PI*2;
    const radius = Math.random() * 100;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const terrainY = world.terrainHeight(x, z);
    const cx = Math.floor(x), cz = Math.floor(z);
    let safe = true;
    for (let y=terrainY; y<terrainY+2; y++) if (world.getBlock(cx, y, cz) !== AIR) { safe=false; break; }
    if (safe && world.getBlock(cx, terrainY-1, cz) !== AIR && terrainY>0)
      return { x: cx+0.5, y: terrainY, z: cz+0.5 };
  }
  return { x: 0.5, y: world.terrainHeight(0,0), z: 0.5 };
}

function suicide() {
  stats.hp = 50; activeEffects.clear(); renderStats();
  const spawn = findSafeSpawn();
  player.pos.set(spawn.x, spawn.y, spawn.z);
  player.vel.set(0,0,0); player.knock.set(0,0,0);
  addChatMessage('Система', 'Вы совершили самоубийство');
}

chatInput.addEventListener('focus', () => { chatFocused = true; keys.clear(); });
chatInput.addEventListener('blur', () => { chatFocused = false; });
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    let msg = chatInput.value.trim();
    if (msg.startsWith('/')) {
      if (msg === '/kill') suicide();
      else if (msg === '/fly') { player.flying = !player.flying; player.vel.set(0,0,0); addChatMessage('Система', player.flying?'Режим полёта включён':'Режим полёта выключен'); }
      else if (msg === '/shadowstep') net.send('shadow_step', {});
      else addChatMessage('Система', `Неизвестная команда: ${msg}`);
      chatInput.value = ''; chatInput.blur();
      return;
    }
    net.send('chat', { message: msg });
    addChatMessage('You', msg);
    chatInput.value = ''; chatInput.blur();
  }
});
chatInput.addEventListener('keydown', (e) => { if(e.key==='Escape') { chatInput.blur(); chatFocused=false; e.preventDefault(); } });

// ========== Оффлайн-магия ==========
let localMagic = null;
function makeLocalCtx() {
  return {
    getBlock: (x,y,z) => world.getBlock(x,y,z),
    setBlock: (x,y,z,t) => world.setBlock(x,y,z,t).forEach(remeshChunk),
    terrainHeight: (x,z) => world.terrainHeight(x,z),
    getPlayers: () => [['me', { x:player.pos.x, y:player.pos.y, z:player.pos.z }]],
    applyDamage: (id,dmg,src) => {
      stats.hp -= dmg; renderStats(); damageFlash();
      if(src.kb>0) { const d = new THREE.Vector3(player.pos.x-src.ax,0,player.pos.z-src.az).normalize(); player.knock.addScaledVector(d,src.kb); player.vel.y+=4; }
      if(stats.hp<=0) { stats.hp=50; activeEffects.clear(); renderStats(); const s=findSafeSpawn(); player.pos.set(s.x,s.y,s.z); }
    },
    addEffect: (id,type,dur,power) => activeEffects.set(type, { until: Date.now()+dur*1000, power: power?.power ?? power }),
    healPlayer: (id,a) => { if(!effectActive('curse')) { stats.hp = Math.min(50, stats.hp+a); renderStats(); } },
    clearDebuffs: () => { for(const b of ['burning','slow','freeze','curse','blind','weakness','vulnerability','disorient','disarm','shadow_shackles']) activeEffects.delete(b); },
    getMana: () => stats.mana,
    spendMana: (id,c) => { stats.mana -= c; renderStats(); },
    teleportPlayer: (id,x,y,z) => { player.pos.set(x,y,z); player.vel.set(0,0,0); },
    emit: (t,d) => EVENTS[t]?.(d),
  };
}

function castSpell() {
  if (!spellQueue.length) return;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  if (net.connected) net.send('cast', { elements: [...spellQueue], dir: [dir.x,dir.y,dir.z] });
  else {
    if (!localMagic) localMagic = createMagicEngine(makeLocalCtx());
    localMagic.cast('me', [...spellQueue], [dir.x,dir.y,dir.z], { x:camera.position.x, y:camera.position.y, z:camera.position.z }, yaw);
  }
  spellQueue.length = 0;
  refreshQueueUI();
}

// ========== Отправка позиции ==========
let lastSent=0, lastYawSent=0, lastPosSent=new THREE.Vector3(Infinity,0,0);
function syncPosition(now) {
  if (!net.connected || !myId) return;
  if (now-lastSent<100) return;
  if (lastPosSent.distanceToSquared(player.pos)<0.0004 && Math.abs(yaw-lastYawSent)<0.01) return;
  lastSent = now; lastPosSent.copy(player.pos); lastYawSent = yaw;
  net.send('move', { x:+player.pos.x.toFixed(2), y:+player.pos.y.toFixed(2), z:+player.pos.z.toFixed(2), yaw:+yaw.toFixed(2) });
}

// ========== Управление ==========
renderer.domElement.addEventListener('click', () => { if(!invOpen) renderer.domElement.requestPointerLock(); });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || settingsOpen) return;
  yaw -= e.movementX * SENS;
  pitch -= e.movementY * SENS;
  pitch = Math.max(-Math.PI/2+0.01, Math.min(Math.PI/2-0.01, pitch));
});

const keys = new Set();
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' && !chatFocused) { e.preventDefault(); spellBookOpen ? closeSpellBook() : openSpellBook(); return; }
  if (e.code === 'Escape') { if(spellBookOpen) closeSpellBook(); else if(settingsOpen) toggleSettings(false); else if(chatFocused) chatInput.blur(); return; }
  if (e.code === 'Tab') { e.preventDefault(); toggleSettings(!settingsOpen); return; }
  if (settingsOpen || chatFocused) return;
  if (e.code === 'KeyT') { chatInput.focus(); chatInput.value=''; e.preventDefault(); return; }
  if (e.code === 'Slash') { chatInput.focus(); chatInput.value='/'; e.preventDefault(); return; }
  if (e.code === 'KeyE') { toggleInventory(); return; }
  if (invOpen) return;
  if (e.code === 'KeyQ') { combatMode = !combatMode; spellQueue.length=0; refreshQueueUI(); ringEl.classList.toggle('combat',combatMode); return; }
  if (e.code === 'KeyX' && combatMode) { spellQueue.length=0; refreshQueueUI(); return; }
  keys.add(e.code);
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n>=1 && n<=9) combatMode ? addElement(n-1) : (selectedSlot=n-1, refreshUI());
  }
});
document.addEventListener('keyup', e => keys.delete(e.code));
document.addEventListener('wheel', e => {
  if (spellBookOpen) {
    if(e.deltaY>0) currentPage = (currentPage+1) % Math.ceil(SPELLS.length/SPELLS_PER_PAGE);
    else currentPage = (currentPage-1+Math.ceil(SPELLS.length/SPELLS_PER_PAGE)) % Math.ceil(SPELLS.length/SPELLS_PER_PAGE);
    renderSpellBook(); e.preventDefault(); return;
  }
  if (invOpen || combatMode) return;
  selectedSlot = (selectedSlot + (e.deltaY>0?1:-1) + 9) % 9;
  refreshUI();
});

// ========== Физика ==========
function moveAxis(dt, axis) {
  player.pos[axis] += player.vel[axis] * dt;
  const half = PLAYER.width/2, E=1e-4;
  const min = { x:player.pos.x-half, y:player.pos.y, z:player.pos.z-half };
  const max = { x:player.pos.x+half, y:player.pos.y+PLAYER.height, z:player.pos.z+half };
  for (let y=Math.floor(min.y); y<=Math.floor(max.y-E); y++)
    for (let x=Math.floor(min.x); x<=Math.floor(max.x-E); x++)
      for (let z=Math.floor(min.z); z<=Math.floor(max.z-E); z++) {
        if (world.getBlock(x,y,z) === AIR) continue;
        if (axis === 'y') {
          if (player.vel.y<0) { player.pos.y = y+1; player.onGround=true; }
          else player.pos.y = y - PLAYER.height;
        } else if (axis === 'x') player.pos.x = player.vel.x>0 ? x-half-E : x+1+half+E;
        else player.pos.z = player.vel.z>0 ? z-half-E : z+1+half+E;
        player.vel[axis] = 0;
        return;
      }
}

function resolveBlockStuck() {
  const half = PLAYER.width/2;
  const minX = Math.floor(player.pos.x-half), maxX = Math.floor(player.pos.x+half);
  const minZ = Math.floor(player.pos.z-half), maxZ = Math.floor(player.pos.z+half);
  const feetY = Math.floor(player.pos.y), headY = Math.floor(player.pos.y+PLAYER.height-0.2);
  for (let y=feetY; y<=headY; y++)
    for (let x=minX; x<=maxX; x++)
      for (let z=minZ; z<=maxZ; z++)
        if (world.getBlock(x,y,z) !== AIR) {
          for (let dx=-5; dx<=5; dx++) for (let dz=-5; dz<=5; dz++) {
            const nx = Math.floor(player.pos.x+dx), nz = Math.floor(player.pos.z+dz);
            const gy = world.terrainHeight(nx, nz);
            if (world.getBlock(nx, gy+1, nz)===AIR && world.getBlock(nx, gy+2, nz)===AIR && world.getBlock(nx, gy, nz)!==AIR) {
              player.pos.set(nx+0.5, gy+1, nz+0.5); player.vel.set(0,0,0); player.knock.set(0,0,0); return;
            }
          }
          player.pos.y += 1; return;
        }
}

function updatePlayer(dt) {
  camera.rotation.set(pitch, yaw, 0);
  let speedMul = 1;
  if (effectActive('speed')) speedMul *= effectActive('speed').power;
  if (effectActive('slow')) speedMul *= 0.5;
  if (effectActive('freeze')) speedMul = 0;
  let jumpPower = JUMP_SPEED;
  if (effectActive('jump_boost')) jumpPower *= 1.5;

  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const wish = new THREE.Vector3();
  if (keys.has('KeyW')) wish.add(forward);
  if (keys.has('KeyS')) wish.sub(forward);
  if (keys.has('KeyD')) wish.add(right);
  if (keys.has('KeyA')) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize();

  if (player.flying) {
    if (keys.has('Space')) wish.y += 1;
    if (keys.has('ShiftLeft')) wish.y -= 1;
    player.pos.addScaledVector(wish, FLY_SPEED * speedMul * dt);
  } else {
    player.vel.x = wish.x * WALK_SPEED * speedMul + player.knock.x;
    player.vel.z = wish.z * WALK_SPEED * speedMul + player.knock.z;
    const decay = Math.pow(0.03, dt);
    player.knock.x *= decay; player.knock.z *= decay;
    if (effectActive('levitate')) player.vel.y = keys.has('Space') ? 4 : keys.has('ShiftLeft') ? -4 : 0;
    else { player.vel.y -= GRAVITY * dt; if (keys.has('Space') && player.onGround && speedMul>0) player.vel.y = jumpPower; }
    player.onGround = false;
    moveAxis(dt,'y'); moveAxis(dt,'x'); moveAxis(dt,'z');
  }
  if (effectActive('weightless')) {
    if (!player.flying && !player.onGround && player.vel.y<0) player.vel.y *= 0.98;
    if (keys.has('Space') && !player.onGround && !player.doubleJumpUsed) { player.vel.y=6; player.doubleJumpUsed=true; spawnParticles(player.pos.x,player.pos.y,player.pos.z,0x88ff88,10,1,0.5); }
    if (player.onGround) player.doubleJumpUsed=false;
  } else player.doubleJumpUsed=false;
  if (player.pos.y < -30) { const s=findSafeSpawn(); player.pos.set(s.x,s.y,s.z); player.vel.set(0,0,0); player.knock.set(0,0,0); }
  resolveBlockStuck();
  camera.position.set(player.pos.x, player.pos.y+PLAYER.eye, player.pos.z);
}

// ========== Рейкасты ==========
function raycastBlock(maxDist=5) {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const p = camera.position;
  let prev = null;
  for (let t=0; t<maxDist; t+=0.02) {
    const bx = Math.floor(p.x+dir.x*t), by = Math.floor(p.y+dir.y*t), bz = Math.floor(p.z+dir.z*t);
    if (world.getBlock(bx,by,bz) !== AIR) return { block:[bx,by,bz], prev, dist:t };
    prev = [bx,by,bz];
  }
  return null;
}

function raycastPlayers(maxDist) {
  if (!remotePlayers.size) return null;
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const raycaster = new THREE.Raycaster(camera.position, dir, 0, maxDist);
  let best = null;
  for (const [id, rp] of remotePlayers) {
    const hits = raycaster.intersectObject(rp.group, true);
    if (hits.length && (!best || hits[0].distance < best.dist)) best = { id, dist: hits[0].distance };
  }
  return best;
}

function intersectsPlayer(bx,by,bz) {
  const half = PLAYER.width/2;
  return bx+1 > player.pos.x-half && bx < player.pos.x+half &&
         by+1 > player.pos.y && by < player.pos.y+PLAYER.height &&
         bz+1 > player.pos.z-half && bz < player.pos.z+half;
}

// ========== Инвентарь ==========
const INV_SIZE = 37;
const inventory = new Array(INV_SIZE).fill(null);
let selectedSlot = 0, held = null, invOpen = false;

function addItem(type) {
  let slot = inventory.find(s => s && s.type===type && s.count<64);
  if (slot) { slot.count++; refreshUI(); return; }
  const i = inventory.findIndex(s => s===null);
  if (i !== -1) { inventory[i] = { type, count:1 }; refreshUI(); }
}

function renderSlot(el, slot) {
  el.innerHTML = '';
  if (!slot) return;
  const swatch = document.createElement('div');
  swatch.className = 'swatch';
  swatch.style.background = '#' + BLOCK_COLORS[slot.type].getHexString();
  const count = document.createElement('div');
  count.className = 'count';
  count.textContent = slot.count;
  el.append(swatch, count);
}

const hotbarEl = document.getElementById('hotbar');
const hudSlots = [];
for (let i=0;i<9;i++) { const el=document.createElement('div'); el.className='slot'; hotbarEl.appendChild(el); hudSlots.push(el); }

const invEl = document.getElementById('inventory');
const invSlots = [];
function makeInvSlot(idx, container) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.addEventListener('mousedown', e => { e.preventDefault(); clickSlot(idx, e.button); });
  container.appendChild(el);
  invSlots[idx] = el;
}
for (let i=9;i<36;i++) makeInvSlot(i, document.getElementById('inv-main'));
for (let i=0;i<9;i++) makeInvSlot(i, document.getElementById('inv-hotbar-row'));
const recycleSlotDiv = document.getElementById('recycle-slot');
if (recycleSlotDiv) recycleSlotDiv.addEventListener('mousedown', e => { e.preventDefault(); clickSlot(36, e.button); });

function clickSlot(i, btn) {
  const slot = inventory[i];
  if (btn===0) {
    if (!held && slot) { held=slot; inventory[i]=null; }
    else if (held && !slot) { inventory[i]=held; held=null; }
    else if (held && slot && slot.type===held.type) {
      const move = Math.min(64-slot.count, held.count);
      slot.count += move; held.count -= move;
      if (held.count<=0) held=null;
    } else if (held && slot) { inventory[i]=held; held=slot; }
  } else if (btn===2) {
    if (!held && slot) {
      const take = Math.ceil(slot.count/2);
      held = { type:slot.type, count:take };
      slot.count -= take;
      if (slot.count<=0) inventory[i]=null;
    } else if (held && !slot) {
      inventory[i] = { type:held.type, count:1 };
      if (--held.count<=0) held=null;
    } else if (held && slot && slot.type===held.type && slot.count<64) {
      slot.count++;
      if (--held.count<=0) held=null;
    }
  }
  refreshUI();
}

const heldEl = document.getElementById('held-item');
document.addEventListener('mousemove', e => { if(held) { heldEl.style.left=e.clientX-18+'px'; heldEl.style.top=e.clientY-18+'px'; } });

function refreshUI() {
  for (let i=0;i<9;i++) { renderSlot(hudSlots[i], inventory[i]); hudSlots[i].classList.toggle('selected', i===selectedSlot); }
  for (let i=0;i<36;i++) renderSlot(invSlots[i], inventory[i]);
  if (recycleSlotDiv) renderSlot(recycleSlotDiv, inventory[36]);
  heldEl.style.display = held ? 'block' : 'none';
  if (held) { heldEl.style.background = '#'+BLOCK_COLORS[held.type].getHexString(); heldEl.querySelector('.count').textContent=held.count; }
}
refreshUI();

const ALL_BLOCK_TYPES = [GRASS,DIRT,STONE,WOOD,LEAVES,PLANKS,SAND,GRAVEL,COAL_ORE,IRON_ORE];
function recycleItem() {
  const slot = inventory[36];
  if (!slot) { addChatMessage('Система','Положите блок в синий слот, чтобы переработать'); return; }
  const newType = ALL_BLOCK_TYPES[Math.floor(Math.random()*ALL_BLOCK_TYPES.length)];
  slot.type = newType; slot.count = 1; refreshUI();
  spawnParticles(player.pos.x, player.pos.y+1, player.pos.z, BLOCK_COLORS[newType].getHex(), 30,2.5,1.2);
  addChatMessage('Система', `Предмет превращён в ${Object.keys(BLOCK_COLORS)[newType]||'блок'}!`);
}
document.getElementById('recycle-button')?.addEventListener('click', recycleItem);

function toggleInventory() {
  invOpen = !invOpen;
  invEl.classList.toggle('open', invOpen);
  if (invOpen) { document.exitPointerLock(); keys.clear(); if(spellBookOpen) closeSpellBook(); }
  else {
    if (held) { for(let n=held.count; n>0; n--) addItem(held.type); held=null; }
    if (!settingsOpen) renderer.domElement.requestPointerLock();
  }
  refreshUI();
}
invEl.addEventListener('contextmenu', e => e.preventDefault());

// ========== Действия мыши ==========
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('mousedown', e => {
  if (!world || document.pointerLockElement !== renderer.domElement) return;
  if (combatMode) {
    if (e.button===0) spellQueue.length ? castSpell() : (()=>{const t=raycastPlayers(4.5); if(t) net.send('attack',{target:t.id});})();
    else if (e.button===2) { spellQueue.pop(); refreshQueueUI(); }
    return;
  }
  const hit = raycastBlock(5);
  if (e.button===0) {
    const target = raycastPlayers(4.5);
    if (target && (!hit || target.dist < hit.dist)) { net.send('attack',{target:target.id}); return; }
    if (!hit) return;
    const [x,y,z] = hit.block;
    addItem(world.getBlock(x,y,z));
    world.setBlock(x,y,z,AIR).forEach(remeshChunk);
    net.send('setBlock',{x,y,z,t:AIR});
  } else if (e.button===2 && hit?.prev) {
    const slot = inventory[selectedSlot];
    if (!slot) return;
    const [x,y,z] = hit.prev;
    if (intersectsPlayer(x,y,z)) return;
    world.setBlock(x,y,z,slot.type).forEach(remeshChunk);
    net.send('setBlock',{x,y,z,t:slot.type});
    if (--slot.count <= 0) inventory[selectedSlot] = null;
    refreshUI();
  }
});

// ========== Цикл анимации ==========
let lastTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now-lastTime)/1000, 0.1);
  lastTime = now;
  if (world) {
    const ready = world.getChunk(Math.floor(player.pos.x/CS), Math.floor(player.pos.z/CS));
    if (ready && !chatFocused && !settingsOpen && !spellBookOpen) updatePlayer(dt);
    updateRemotePlayers(dt);
    for (const pr of projectiles.values()) {
      if (pr.gravity || pr.kind==='meteor') pr.vel.y -= (pr.kind==='meteor'?10:20)*dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      spawnParticles(pr.mesh.position.x, pr.mesh.position.y, pr.mesh.position.z, pr.kind==='meteor'?0xff6622:0xffcc88, 1,0.6,0.35);
    }
    if (!net.connected) {
      if (localMagic) localMagic.tick(dt);
      stats.mana = Math.min(stats.maxMana, stats.mana+dt);
      const burn = effectActive('burning');
      if (burn) { burnAcc += dt; if (burnAcc>=1) { burnAcc-=1; stats.hp -= burn.power; renderStats(); damageFlash(); } }
      renderStats();
    }
    updateTransients(dt);
    updateParticles(dt);
    syncPosition(now);
    renderEffects(now);
    document.getElementById('coord-display').textContent = `X:${player.pos.x.toFixed(2)} Y:${player.pos.y.toFixed(2)} Z:${player.pos.z.toFixed(2)}`;
  }
  renderer.render(scene, camera);
}
createSettingsMenu();
requestAnimationFrame(animate);