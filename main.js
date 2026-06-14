import * as THREE from 'three';
import { World, buildChunkMesh, buildLODMesh, AIR, BLOCK_COLORS, CHUNK_SIZE,
         GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, SAND, GRAVEL, COAL_ORE, IRON_ORE } from './world.js';
import { Network } from './network.js';
import { createMagicEngine } from './magic.js';
import { initParticles, spawnParticles, updateParticles } from './particles.js';

// ========== Книга комбинаций (данные) ==========
const SPELL_COMBINATIONS = [
  { name: "Прыгучесть", elements: "air + air + earth", effect: "+50% высоты прыжка на 75 сек" },
  { name: "Регенерация", elements: "water + light + light", effect: "1 HP/сек на 50 сек" },
  { name: "Огнеупорность", elements: "fire + earth + shield", effect: "50% сопротивления огню на 100 сек" },
  { name: "Огненная аура", elements: "fire + fire + air", effect: "1 урон/сек врагам в радиусе 3 на 60 сек" },
  { name: "Ледяная кожа", elements: "ice + ice + earth", effect: "замедление атакующих на 2 сек (75 сек)" },
  { name: "Разряд (цепная молния)", elements: "beam + fire + air", effect: "20% шанс молнии при атаке (40 сек)" },
  { name: "Невесомость", elements: "air + air + light", effect: "медленное падение + двойной прыжок (50 сек)" },
  { name: "Барьер (личный щит)", elements: "shield + earth", effect: "щит на 4 ед. поглощения (75 сек)" },
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
  { name: "Сфера абсолютной защиты", elements: "shield + earth + air + water + light", effect: "непробиваемая сфера (лечение, отражение 50% урона)" },
  { name: "Астероид", elements: "fire + earth + dark + beam + air", effect: "падающий камень, взрыв, воронка" },
  { name: "Вечный лёд разума", elements: "ice + water + earth + dark + light", effect: "зона замедления времени (радиус 5, 15 сек)" },
  { name: "Феникс-возрождение", elements: "fire + light + air + earth + shield", effect: "при HP<4 возрождается с 8 HP (1 раз)" },
  { name: "Громокаменный топот", elements: "earth + air + fire + beam + shield", effect: "ударная волна, подбрасывает" },
  { name: "Чёрный вихрь", elements: "dark + air + water + earth + beam", effect: "торнадо, периодический урон" },
  { name: "Световая клетка", elements: "light + beam + air + earth + fire", effect: "клетка, урон разрядами каждую секунду" },
  { name: "Теневые оковы", elements: "dark + ice + earth + air + water", effect: "враг не может поворачиваться и тонет" },
  { name: "Дыхание дракона", elements: "fire + dark + air + earth + ice", effect: "конусный выдох (урон, поджог, заморозка, ослабление)" },
  { name: "Электрический тотем", elements: "earth + beam + air", effect: "ставит тотем, дающий ускорение и зарядку оружия" },
  { name: "Метеор", elements: "beam + fire + earth", effect: "падающий взрывной снаряд" },
  { name: "Обычный снаряд", elements: "любая комбинация (кроме shield/beam)", effect: "урон зависит от элементов, взрывной если fire+earth" },
];
let spellBookOpen = false;
let spellBookElement = null;
let spellBookContent = null;
let currentPage = 0;
const SPELLS_PER_PAGE = 8;

// ========== Рендер ==========
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

// ========== Настройки ==========
const SENSITIVITY_KEY = 'voxel_sensitivity';
let currentSens = parseFloat(localStorage.getItem(SENSITIVITY_KEY)) || 0.002;
let SENS = currentSens;
let settingsOpen = false;
let settingsMenu = null;

function createSettingsMenu() {
    if (settingsMenu) return;
    settingsMenu = document.createElement('div');
    settingsMenu.id = 'settings-menu';
    settingsMenu.style.cssText = `
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        width: 300px; background: rgba(30,30,40,0.95); border: 2px solid #aaa;
        border-radius: 8px; padding: 20px; color: white; font-family: monospace;
        display: none; flex-direction: column; gap: 15px; z-index: 200;
        backdrop-filter: blur(4px); box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;
    const title = document.createElement('h3');
    title.textContent = 'Настройки';
    title.style.margin = '0 0 5px 0';
    const sensLabel = document.createElement('label');
    sensLabel.textContent = `Чувствительность мыши: ${(currentSens * 1000).toFixed(1)}`;
    sensLabel.style.display = 'flex';
    sensLabel.style.justifyContent = 'space-between';
    sensLabel.style.alignItems = 'center';
    const range = document.createElement('input');
    range.type = 'range';
    range.min = 0.5;
    range.max = 5;
    range.step = 0.05;
    range.value = currentSens * 1000;
    range.style.width = '150px';
    range.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        currentSens = val / 1000;
        SENS = currentSens;
        localStorage.setItem(SENSITIVITY_KEY, currentSens);
        sensLabel.childNodes[0].nodeValue = `Чувствительность мыши: ${val.toFixed(1)}`;
    });
    sensLabel.appendChild(range);
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть (Esc)';
    closeBtn.style.marginTop = '10px';
    closeBtn.style.padding = '5px';
    closeBtn.style.background = '#555';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'white';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => toggleSettings(false);
    settingsMenu.append(title, sensLabel, closeBtn);
    document.body.appendChild(settingsMenu);
}

function toggleSettings(open) {
    settingsOpen = open;
    if (!settingsMenu) return;
    settingsMenu.style.display = open ? 'flex' : 'none';
    if (open) {
        if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
        if (chatInput) chatInput.blur();
        keys.clear();
        if (spellBookOpen) closeSpellBook();
    } else {
        if (!invOpen && document.pointerLockElement !== renderer.domElement && !chatFocused) {
            renderer.domElement.requestPointerLock();
        }
    }
}

// ========== Функции книги ==========
function renderSpellBook() {
  if (!spellBookContent) return;
  const start = currentPage * SPELLS_PER_PAGE;
  const end = Math.min(start + SPELLS_PER_PAGE, SPELL_COMBINATIONS.length);
  let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
  for (let i = start; i < end; i++) {
    const s = SPELL_COMBINATIONS[i];
    html += `<div style="border-bottom:1px solid #888; padding:4px;">
              <b>${s.name}</b><br>
              <span style="color:#ffaa66;">${s.elements}</span><br>
              <span style="font-size:12px;">${s.effect}</span>
            </div>`;
  }
  html += `</div><div style="margin-top:12px; text-align:center; font-size:14px;">Страница ${Math.floor(currentPage)+1} из ${Math.ceil(SPELL_COMBINATIONS.length/SPELLS_PER_PAGE)}</div>`;
  spellBookContent.innerHTML = html;
}

function openSpellBook() {
  if (spellBookOpen) return;
  spellBookOpen = true;
  if (!spellBookElement) {
    spellBookElement = document.createElement('div');
    spellBookElement.id = 'spell-book';
    spellBookElement.style.cssText = `
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 500px; max-height: 80%; background: rgba(20,20,30,0.95);
      border: 2px solid #c9a87b; border-radius: 12px;
      padding: 16px; color: #f0e6d0; font-family: monospace;
      z-index: 1000; display: flex; flex-direction: column;
      backdrop-filter: blur(8px); box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;
    const title = document.createElement('h2');
    title.textContent = '📖 Книга заклинаний';
    title.style.margin = '0 0 10px 0';
    title.style.textAlign = 'center';
    spellBookElement.appendChild(title);
    spellBookContent = document.createElement('div');
    spellBookContent.style.overflowY = 'auto';
    spellBookContent.style.flex = '1';
    spellBookElement.appendChild(spellBookContent);
    const navDiv = document.createElement('div');
    navDiv.style.display = 'flex';
    navDiv.style.justifyContent = 'space-between';
    navDiv.style.marginTop = '12px';
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀ Назад';
    prevBtn.style.padding = '4px 12px';
    prevBtn.style.cursor = 'pointer';
    prevBtn.onclick = () => { if (currentPage > 0) { currentPage--; renderSpellBook(); } };
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Вперед ▶';
    nextBtn.style.padding = '4px 12px';
    nextBtn.style.cursor = 'pointer';
    nextBtn.onclick = () => { if ((currentPage+1)*SPELLS_PER_PAGE < SPELL_COMBINATIONS.length) { currentPage++; renderSpellBook(); } };
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Закрыть (Esc)';
    closeBtn.style.padding = '4px 12px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = closeSpellBook;
    navDiv.appendChild(prevBtn);
    navDiv.appendChild(closeBtn);
    navDiv.appendChild(nextBtn);
    spellBookElement.appendChild(navDiv);
    document.body.appendChild(spellBookElement);
  }
  renderSpellBook();
  spellBookElement.style.display = 'flex';
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  keys.clear();
}

function closeSpellBook() {
  if (!spellBookOpen) return;
  spellBookOpen = false;
  if (spellBookElement) spellBookElement.style.display = 'none';
  if (!invOpen && !settingsOpen && !chatFocused) {
    renderer.domElement.requestPointerLock();
  }
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
  doubleJumpUsed: false,
};
let yaw = 0, pitch = 0;

// ========== Мир + менеджер чанков ==========
let world = null;
const FULL_RADIUS = 9;
const LOD_RINGS = [
  { level: 2, radius: 20 },
  { level: 3, radius: 48 },
];
const FULL_BUDGET = 8;
const LOD_BUDGET = 6;
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
const stats = { hp: 50, armor: 0, mana: 20, maxMana: 20 };
const activeEffects = new Map();
let burnAcc = 0;

const heartsEl = document.getElementById('hearts');
const manaFill = document.getElementById('mana-fill');
const flashEl = document.getElementById('damage-flash');
const effectsEl = document.getElementById('effects-hud');

function renderStats() {
  let s = '';
  // 10 сердец – это 20 HP, а у нас 50 HP → 25 сердец
  for (let i = 0; i < 25; i++)
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
  jump_boost: '🚀 Прыгучесть', regen: '💚 Регенерация', fire_resist: '🔥 Огнеупорность',
  fire_aura: '🔥 Огненная аура', ice_skin: '❄ Ледяная кожа', chain_lightning: '⚡ Разряд',
  blind: '🌫️ Ослепление', weightless: '🍃 Невесомость',
  weakness: '📉 Слабость', vulnerability: '🎯 Уязвимость', disorient: '🌀 Дезориентация',
  disarm: '⚔️ Разоружение', shadow_shackles: '⛓️ Теневые оковы', fear: '😨 Страх',
  time_slow: '⏳ Замедление времени',
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
  spellQueue.push(id);
  flashIcon(i);
  refreshQueueUI();
}

// ========== Снаряды, мины, временные визуалы ==========
const PROJ_COLORS = {
  fire: 0xf4502a, water: 0x3a6cf4, air: 0xbfe8ff, earth: 0x8b5a2b,
  ice: 0x9ff5ff, dark: 0x603a80, light: 0xffe9a0, beam: 0xffd34d,
  chaos: 0xaa44ff,dragon_fireball: 0xff6633,
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
let myNickname = '';
const remotePlayers = new Map(); // id -> { group, target, yaw, nickname, lastPos, phase }

function createPlayerModel(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
  
  const legGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
  const leftLeg = new THREE.Mesh(legGeo, mat);
  leftLeg.name = 'leftLeg';
  leftLeg.position.set(-0.2, 0.3, 0);
  group.add(leftLeg);
  const rightLeg = new THREE.Mesh(legGeo, mat);
  rightLeg.name = 'rightLeg';
  rightLeg.position.set(0.2, 0.3, 0);
  group.add(rightLeg);
  
  const torsoGeo = new THREE.BoxGeometry(0.6, 0.8, 0.3);
  const torso = new THREE.Mesh(torsoGeo, mat);
  torso.position.set(0, 1, 0);
  group.add(torso);
  
  const armGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
  const leftArm = new THREE.Mesh(armGeo, mat);
  leftArm.name = 'leftArm';
  leftArm.position.set(-0.45, 1.1, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, mat);
  rightArm.name = 'rightArm';
  rightArm.position.set(0.45, 1.1, 0);
  group.add(rightArm);
  
  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.set(0, 1.6, 0);
  group.add(head);
  
  const hitboxGeo = new THREE.BoxGeometry(PLAYER.width, PLAYER.height, PLAYER.width);
  const hitboxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, visible: true });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.position.set(0, PLAYER.height / 2, 0);
  group.add(hitbox);
  
  group.userData = { leftArm, rightArm, leftLeg, rightLeg };
  return group;
}

function flashPlayerModel(group, duration = 200) {
  if (!group) return;
  group.children.forEach(child => {
    if (child.isMesh && child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(mat => {
          if (!mat.userData.originalColor) mat.userData.originalColor = mat.color.clone();
          mat.color.setHex(0xff0000);
        });
      } else {
        if (!child.material.userData.originalColor) child.material.userData.originalColor = child.material.color.clone();
        child.material.color.setHex(0xff0000);
      }
    }
  });
  if (group._flashTimer) clearTimeout(group._flashTimer);
  group._flashTimer = setTimeout(() => {
    group.children.forEach(child => {
      if (child.isMesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => {
            if (mat.userData.originalColor) mat.color.copy(mat.userData.originalColor);
          });
        } else {
          if (child.material.userData.originalColor) child.material.color.copy(child.material.userData.originalColor);
        }
      }
    });
    group._flashTimer = null;
  }, duration);
}

function addRemotePlayer(id, p) {
  if (id === myId || remotePlayers.has(id)) return;
  const hue = (id * 0.61) % 1;
  const color = new THREE.Color().setHSL(hue, 0.7, 0.5);
  const group = createPlayerModel(color);
  group.position.set(p.x, p.y, p.z);
  scene.add(group);
  remotePlayers.set(id, {
    group,
    target: new THREE.Vector3(p.x, p.y, p.z),
    yaw: p.yaw || 0,
    nickname: p.nickname || `Player ${id}`,
    lastPos: new THREE.Vector3(p.x, p.y, p.z),
    phase: 0,
  });
  setStatus(`онлайн · игроков: ${remotePlayers.size}`);
}
function removeRemotePlayer(id) {
  const rp = remotePlayers.get(id);
  if (!rp) return;
  scene.remove(rp.group);
  remotePlayers.delete(id);
  setStatus(`онлайн · игроков: ${remotePlayers.size}`);
}
function updateRemotePlayers(dt) {
  const k = 1 - Math.pow(0.0001, dt);
  const tmp = new THREE.Vector3();
  for (const rp of remotePlayers.values()) {
    tmp.set(rp.target.x, rp.target.y, rp.target.z);
    rp.group.position.lerp(tmp, k);
    rp.group.rotation.y += (rp.yaw - rp.group.rotation.y) * k;
    
    const dx = rp.group.position.x - rp.lastPos.x;
    const dz = rp.group.position.z - rp.lastPos.z;
    const speed = Math.hypot(dx, dz);
    const animSpeed = 12.0;
    const armAmp = 0.8;
    const legAmp = 0.5;
    if (speed > 0.01) rp.phase += speed * animSpeed;
    else rp.phase *= 0.95;
    const leftArm = rp.group.userData.leftArm;
    const rightArm = rp.group.userData.rightArm;
    const leftLeg = rp.group.userData.leftLeg;
    const rightLeg = rp.group.userData.rightLeg;
    if (leftArm && rightArm && leftLeg && rightLeg) {
      const angle = Math.sin(rp.phase) * armAmp;
      leftArm.rotation.x = angle;
      rightArm.rotation.x = -angle;
      const legAngle = Math.sin(rp.phase) * legAmp;
      leftLeg.rotation.x = -legAngle;
      rightLeg.rotation.x = legAngle;
    }
    rp.lastPos.copy(rp.group.position);
  }
}

const net = new Network(SERVER_URL);

// --- Общие игровые события ---
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
  lightningEffect: (m) => {
    const from = remotePlayers.get(m.from)?.group.position || player.pos;
    const to = remotePlayers.get(m.to)?.group.position || player.pos;
    const points = [from.clone(), to.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffaa44, linewidth: 2 }));
    scene.add(line);
    setTimeout(() => scene.remove(line), 200);
    spawnParticles(to.x, to.y + 1, to.z, 0xffaa44, 15, 2, 0.5);
  },
  zoneSpawn: (m) => {
    const ringGeo = new THREE.RingGeometry(m.radius - 0.2, m.radius + 0.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x88ffaa, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(m.x, 0.1, m.z);
    scene.add(ring);
    const interval = setInterval(() => {
      if (!ring.parent) { clearInterval(interval); return; }
      spawnParticles(m.x + (Math.random() - 0.5) * m.radius, 0.5, m.z + (Math.random() - 0.5) * m.radius, 0xaaffaa, 3, 0.5, 0.3);
    }, 500);
    setTimeout(() => { scene.remove(ring); clearInterval(interval); }, (m.duration || 8) * 1000);
  },
  zoneEnd: () => {},
  chainLink: (m) => {
    const p1 = remotePlayers.get(m.id1)?.group;
    const p2 = remotePlayers.get(m.id2)?.group;
    if (p1 && p2) {
      const points = [p1.position.clone(), p2.position.clone()];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xff44ff, linewidth: 2 }));
      scene.add(line);
      setTimeout(() => scene.remove(line), 5000);
    }
  },
  swapFx: (m) => {
    const p1 = remotePlayers.get(m.id1)?.group || player.pos;
    const p2 = remotePlayers.get(m.id2)?.group || player.pos;
    if (p1 && p2) {
      spawnParticles(p1.position.x, p1.position.y + 1, p1.position.z, 0x33aaff, 30, 3, 0.8);
      spawnParticles(p2.position.x, p2.position.y + 1, p2.position.z, 0x33aaff, 30, 3, 0.8);
    }
  },
  shadowStepFx: (m) => {
    spawnParticles(m.x0, 1, m.z0, 0x9900ff, 40, 4, 0.7);
    spawnParticles(m.x1, 1, m.z1, 0x9900ff, 40, 4, 0.7);
  },
  dragonBreathCone: (m) => {
  // Массивная струя частиц (конус)
  const origin = new THREE.Vector3(m.origin.x, m.origin.y + 1.2, m.origin.z);
  const yaw = m.yaw;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < 200; i++) {
    const t = Math.random(); // 0..1 – расстояние (макс 8)
    const dist = t * 8;
    const coneRadius = dist * 0.6;
    const angle = Math.random() * Math.PI * 2;
    const offX = Math.cos(angle) * coneRadius * Math.random();
    const offZ = Math.sin(angle) * coneRadius * Math.random();
    const offY = (Math.random() - 0.5) * 1.2;
    const pos = origin.clone()
      .addScaledVector(forward, dist)
      .addScaledVector(right, offX)
      .addScaledVector(up, offY);
    const color = 0xff8844 + Math.floor(Math.random() * 0x4422);
    spawnParticles(pos.x, pos.y, pos.z, color, 2, 0.7 + Math.random() * 0.8, 0.9);
  }

  // Быстрые «огненные шары»
  for (let i = 0; i < 30; i++) {
    const dist = Math.random() * 7;
    const rad = dist * 0.5;
    const angle = Math.random() * Math.PI * 2;
    const offX = Math.cos(angle) * rad;
    const offZ = Math.sin(angle) * rad;
    const offY = (Math.random() - 0.5) * 1.0;
    const pos = origin.clone()
      .addScaledVector(forward, dist)
      .addScaledVector(right, offX)
      .addScaledVector(up, offY);
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 5, 5),
      new THREE.MeshBasicMaterial({ color: 0xff5533, transparent: true })
    );
    sphere.position.copy(pos);
    scene.add(sphere);
    let life = 0.35;
    const timer = setInterval(() => {
      life -= 0.05;
      if (life <= 0) {
        clearInterval(timer);
        scene.remove(sphere);
        sphere.material.dispose();
        sphere.geometry.dispose();
      } else {
        sphere.material.opacity = life / 0.35;
      }
    }, 50);
  }

  // Пыль от земли
  for (let i = 0; i < 60; i++) {
    const dist = Math.random() * 7;
    const rad = dist * 0.7;
    const angle = Math.random() * Math.PI * 2;
    const offX = Math.cos(angle) * rad;
    const offZ = Math.sin(angle) * rad;
    const groundY = world.terrainHeight(origin.x + offX, origin.z + offZ) + 0.1;
    spawnParticles(origin.x + offX, groundY, origin.z + offZ, 0xaa7755, 3, 0.4, 0.8);
  }
},

dragonBreathFx: (m) => {
  // Вспышка на цели
  const pos = new THREE.Vector3(m.to.x, m.to.y + 1, m.to.z);
  spawnParticles(pos.x, pos.y, pos.z, 0xff5533, 50, 2.5, 1.2);
  // Дополнительный взрывной ореол
  const ring = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.6 })
  );
  ring.position.copy(pos);
  scene.add(ring);
  let scale = 1;
  const grow = setInterval(() => {
    scale += 0.3;
    ring.scale.set(scale, scale, scale);
    ring.material.opacity -= 0.05;
    if (ring.material.opacity <= 0) {
      clearInterval(grow);
      scene.remove(ring);
      ring.material.dispose();
      ring.geometry.dispose();
    }
  }, 30);
},
  totemSpawn: (m) => {
    const geo = new THREE.BoxGeometry(0.8, 1.2, 0.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0x442200 });
    const totem = new THREE.Mesh(geo, mat);
    totem.position.set(m.x, 0.6, m.z);
    scene.add(totem);
    setTimeout(() => scene.remove(totem), (m.duration || 30) * 1000);
  },
  totemCharge: (m) => {
    const target = remotePlayers.get(m.targetId);
    if (target) {
      spawnParticles(target.group.position.x, target.group.position.y + 1, target.group.position.z, 0xffaa44, 20, 1.5, 0.5);
    }
  },
  totemPower: (m) => {
    // визуально – вспышка на цели
    const target = remotePlayers.get(m.targetId);
    if (target) {
      spawnParticles(target.group.position.x, target.group.position.y + 1, target.group.position.z, 0xffdd88, 15, 1, 0.3);
    }
  },
  totemEnd: (m) => {},
  sphereSpawn: (m) => {
    const sphereGeo = new THREE.SphereGeometry(3, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.3, wireframe: true });
    const sphere = new THREE.Mesh(sphereGeo, mat);
    sphere.position.set(m.x, m.y + 1.5, m.z);
    scene.add(sphere);
    setTimeout(() => scene.remove(sphere), (m.duration || 8) * 1000);
  },
  sphereEnd: (m) => {},
  asteroidStart: (m) => {
    const geo = new THREE.SphereGeometry(1.5, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x441111 });
    const asteroid = new THREE.Mesh(geo, mat);
    asteroid.position.set(m.x, m.startY, m.z);
    scene.add(asteroid);
    // анимация падения
    let t = 0;
    const fall = setInterval(() => {
      t += 0.05;
      asteroid.position.y -= 2;
      if (asteroid.position.y < 1) {
        clearInterval(fall);
        scene.remove(asteroid);
      }
    }, 50);
    setTimeout(() => scene.remove(asteroid), 1500);
  },
  asteroidImpact: (m) => {
    spawnParticles(m.x, 2, m.z, 0x884422, 100, 6, 1.2);
    for (let i = 0; i < 50; i++) {
      const dx = (Math.random() - 0.5) * m.radius * 2;
      const dz = (Math.random() - 0.5) * m.radius * 2;
      spawnParticles(m.x + dx, 1, m.z + dz, 0x664422, 5, 1, 0.8);
    }
  },
  stompFx: (m) => {
    const ringGeo = new THREE.RingGeometry(0.5, m.radius, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa44, side: THREE.DoubleSide, transparent: true });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(m.x, 0.1, m.z);
    scene.add(ring);
    setTimeout(() => scene.remove(ring), 500);
    spawnParticles(m.x, 0.5, m.z, 0xffaa44, 40, 3, 0.6);
  },
  vortexSpawn: (m) => {
    const points = [];
    for (let i = 0; i <= 20; i++) {
      const angle = i * Math.PI * 2 / 20;
      const x = m.x + Math.cos(angle) * 4;
      const z = m.z + Math.sin(angle) * 4;
      points.push(new THREE.Vector3(x, 0.2, z));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x660066 });
    const circle = new THREE.LineLoop(lineGeo, lineMat);
    scene.add(circle);
    setTimeout(() => scene.remove(circle), (m.duration || 8) * 1000);
  },
  vortexEnd: () => {},
  cageSpawn: (m) => {
    const target = remotePlayers.get(m.targetId);
    if (target) {
      const box = new THREE.BoxHelper(target.group, 0xff44ff);
      scene.add(box);
      setTimeout(() => scene.remove(box), 6000);
    }
  },
  cageEnd: (m) => {},
  shacklesFx: (m) => {
    const target = remotePlayers.get(m.targetId);
    if (target) {
      spawnParticles(target.group.position.x, target.group.position.y + 1, target.group.position.z, 0x000000, 30, 2, 1);
    }
  },
  timeSlowZone: (m) => {
    const ringGeo = new THREE.RingGeometry(m.radius - 0.2, m.radius + 0.2, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x88aaff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(m.x, 0.1, m.z);
    scene.add(ring);
    setTimeout(() => scene.remove(ring), (m.duration || 15) * 1000);
  },
};
for (const [t, f] of Object.entries(EVENTS)) net.on(t, f);

// Ослепление (оверлей)
let blindnessOverlay = null;
function setBlindness(active) {
  if (!blindnessOverlay) {
    blindnessOverlay = document.createElement('div');
    blindnessOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,200,0.7); pointer-events:none; z-index:1000; display:none;';
    document.body.appendChild(blindnessOverlay);
  }
  blindnessOverlay.style.display = active ? 'block' : 'none';
}

// Барьер (визуал)
let shieldMesh = null;

net.on('init', (m) => {
  myId = m.id;
  myNickname = m.nickname;
  startWorld(m.seed, m.edits);
  for (const p of m.players) addRemotePlayer(p.id, p);
  if (m.snapshot) {
    for (const pr of m.snapshot.projectiles) EVENTS.projSpawn(pr);
    for (const mn of m.snapshot.mines) EVENTS.mineSpawn(mn);
  }
  if (m.zones) m.zones.forEach(z => EVENTS.zoneSpawn(z));
  if (m.timeSlowZones) m.timeSlowZones.forEach(z => EVENTS.timeSlowZone(z));
  setStatus(`онлайн · игроков: ${remotePlayers.size}`);
});
net.on('join',  (m) => addRemotePlayer(m.id, { x: 0.5, y: 80, z: 0.5, yaw: 0, nickname: m.nickname }));
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
      flashPlayerModel(rp.group, 200);
      const pos = rp.group.position;
      spawnParticles(pos.x, pos.y + 1, pos.z, 0xff3333, 20, 2, 1.0);
    }
  }
});
net.on('mana', (m) => { stats.mana = m.mana; renderStats(); });
net.on('effects', (m) => {
  activeEffects.clear();
  for (const it of m.list) activeEffects.set(it.e, { until: it.until, power: it.power });
  setBlindness(activeEffects.has('blind'));
  // Визуал дезориентации (переворот экрана)
  if (activeEffects.has('disorient')) {
    document.body.style.transform = 'rotate(180deg)';
    setTimeout(() => document.body.style.transform = '', 6000);
  }
  // Визуал страха (эффект размытия)
  if (activeEffects.has('fear')) {
    document.body.style.filter = 'blur(4px)';
    setTimeout(() => document.body.style.filter = '', 5000);
  }
  if (activeEffects.has('ward')) {
    if (!shieldMesh) {
      const sphereGeo = new THREE.SphereGeometry(0.8, 16, 16);
      const shieldMat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.3, wireframe: true });
      shieldMesh = new THREE.Mesh(sphereGeo, shieldMat);
      shieldMesh.position.set(0, 1, 0);
      camera.add(shieldMesh);
    }
  } else {
    if (shieldMesh) { camera.remove(shieldMesh); shieldMesh = null; }
  }
  // Теневые оковы: фиксация обзора на сервере – добавим клиентский эффект
  if (activeEffects.has('shadow_shackles')) {
    // заблокируем поворот камеры
    document.body.style.pointerEvents = 'none';
    setTimeout(() => document.body.style.pointerEvents = '', 6000);
  }
});
net.on('damaged', (m) => {
  stats.hp = m.hp; renderStats(); damageFlash();
  spawnParticles(camera.position.x, camera.position.y - 0.5, camera.position.z, 0xff4444, 15, 1.5, 0.8);
  const kb = m.kb ?? 8;
  if (kb > 0) {
    const dir = new THREE.Vector3(player.pos.x - m.ax, 0, player.pos.z - m.az).normalize();
    player.knock.addScaledVector(dir, kb);
    player.vel.y += 4;
  }
});
net.on('respawn', (m) => {
  if (m.id !== myId) return;
  stats.hp = 50; renderStats();
  activeEffects.clear();
  let attempts = 0;
  let foundSpot = false;
  let spawnX = 0, spawnZ = 0, spawnY = 0;
  while (!foundSpot && attempts < 20) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 100;
    spawnX = Math.cos(angle) * radius;
    spawnZ = Math.sin(angle) * radius;
    const terrainY = world.terrainHeight(spawnX, spawnZ);
    const checkX = Math.floor(spawnX);
    const checkZ = Math.floor(spawnZ);
    let safe = true;
    for (let y = terrainY; y < terrainY + 2; y++) {
      if (world.getBlock(checkX, y, checkZ) !== 0) { safe = false; break; }
    }
    const groundBlock = world.getBlock(checkX, terrainY - 1, checkZ);
    if (safe && groundBlock !== 0 && terrainY > 0) { spawnY = terrainY; foundSpot = true; }
    attempts++;
  }
  if (!foundSpot) {
    spawnX = 0; spawnZ = 0;
    spawnY = world.terrainHeight(0, 0);
  }
  player.pos.set(spawnX + 0.5, spawnY, spawnZ + 0.5);
  player.vel.set(0, 0, 0);
  player.knock.set(0, 0, 0);
});
net.on('disconnect', () => {
  if (!world) startWorld(Math.random() * 10000);
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
  setStatus('оффлайн (одиночная игра)');
});
net.on('systemMessage', (msg) => {
  addChatMessage('Система', msg.message);
});
net.on('chat', (msg) => {
  const senderName = msg.senderId === myId ? 'You' : (msg.senderNick || `Player ${msg.senderId}`);
  addChatMessage(senderName, msg.message);
});

// ========== Чат и координаты ==========
const coordDisplay = document.getElementById('coord-display');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
let chatFocused = false;

function updateCoordDisplay() {
  if (coordDisplay) {
    coordDisplay.textContent = `X: ${player.pos.x.toFixed(2)} Y: ${player.pos.y.toFixed(2)} Z: ${player.pos.z.toFixed(2)}`;
  }
}

function addChatMessage(sender, message) {
  const msgDiv = document.createElement('div');
  msgDiv.textContent = `${sender}: ${message}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function suicide() {
  stats.hp = 0;
  renderStats();
  damageFlash();
  stats.hp = 50;
  activeEffects.clear();
  renderStats();
  let attempts = 0;
  let foundSpot = false;
  let spawnX = 0, spawnZ = 0, spawnY = 0;
  while (!foundSpot && attempts < 20) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 100;
    spawnX = Math.cos(angle) * radius;
    spawnZ = Math.sin(angle) * radius;
    const terrainY = world.terrainHeight(spawnX, spawnZ);
    const checkX = Math.floor(spawnX);
    const checkZ = Math.floor(spawnZ);
    let safe = true;
    for (let y = terrainY; y < terrainY + 2; y++) {
      if (world.getBlock(checkX, y, checkZ) !== 0) { safe = false; break; }
    }
    const groundBlock = world.getBlock(checkX, terrainY - 1, checkZ);
    if (safe && groundBlock !== 0 && terrainY > 0) { spawnY = terrainY; foundSpot = true; }
    attempts++;
  }
  if (!foundSpot) {
    spawnX = 0; spawnZ = 0;
    spawnY = world.terrainHeight(0, 0);
  }
  player.pos.set(spawnX + 0.5, spawnY, spawnZ + 0.5);
  player.vel.set(0, 0, 0);
  player.knock.set(0, 0, 0);
  addChatMessage('Система', 'Вы совершили самоубийство');
}

chatInput.addEventListener('focus', () => {
  chatFocused = true;
  keys.clear();
});
chatInput.addEventListener('blur', () => {
  chatFocused = false;
});

chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    let message = chatInput.value.trim();
    if (message.startsWith('/')) {
      if (message === '/kill') {
        suicide();
      } else if (message === '/fly') {
        player.flying = !player.flying;
        player.vel.set(0, 0, 0);
        addChatMessage('Система', player.flying ? 'Режим полёта включён' : 'Режим полёта выключен');
      } else if (message === '/shadowstep') {
        net.send('shadow_step', {});
        addChatMessage('Система', 'Теневой шаг активирован');
      } else {
        addChatMessage('Система', `Неизвестная команда: ${message}`);
      }
      chatInput.value = '';
      chatInput.blur();
      return;
    }
    net.send('chat', { message: message });
    addChatMessage('You', message);
    chatInput.value = '';
    chatInput.blur();
  }
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    chatInput.blur();
    chatFocused = false;
    e.preventDefault();
  }
});

createSettingsMenu();

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
        stats.hp = 50; activeEffects.clear(); renderStats();
        player.pos.set(0.5, world.terrainHeight(0, 0) + 1, 0.5);
      }
    },
    addEffect: (id, type, dur, power) =>
      activeEffects.set(type, { until: Date.now() + dur * 1000, power: power?.power ?? power }),
    healPlayer: (id, a) => {
      if (effectActive('curse')) return;
      stats.hp = Math.min(50, stats.hp + a); renderStats();
    },
    clearDebuffs: () => { for (const b of ['burning','slow','freeze','curse','blind','weakness','vulnerability','disorient','disarm','shadow_shackles']) activeEffects.delete(b); },
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
  if (settingsOpen) return;
  yaw   -= e.movementX * SENS;
  pitch -= e.movementY * SENS;
  const lim = Math.PI / 2 - 0.01;
  pitch = Math.max(-lim, Math.min(lim, pitch));
});

const keys = new Set();
document.addEventListener('keydown', (e) => {
  // ========== КНИГА: H ==========
  if (e.code === 'KeyH' && !chatFocused) {
    e.preventDefault();

    if (spellBookOpen) closeSpellBook();
    else openSpellBook();
    return;
  }
  if (e.code === 'Escape' && spellBookOpen) {
    closeSpellBook();
    e.preventDefault();
    return;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    toggleSettings(!settingsOpen);
    return;
  }
  if (e.code === 'Escape' && settingsOpen) {
    e.preventDefault();
    toggleSettings(false);
    return;
  }
  if (settingsOpen) return;
  if (chatFocused) return;

  if (e.code === 'KeyT') {
    chatInput.focus();
    chatInput.value = '';
    e.preventDefault();
    return;
  }
  if (e.code === 'Slash') {
    chatInput.focus();
    chatInput.value = '/';
    e.preventDefault();
    return;
  }

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
  // Листание книги, если открыта
  if (spellBookOpen) {
    if (e.deltaY > 0) {
      if ((currentPage+1)*SPELLS_PER_PAGE < SPELL_COMBINATIONS.length) currentPage++;
      else currentPage = 0;
    } else {
      if (currentPage > 0) currentPage--;
      else currentPage = Math.ceil(SPELL_COMBINATIONS.length/SPELLS_PER_PAGE)-1;
    }
    renderSpellBook();
    e.preventDefault();
    return;
  }
  if (invOpen || combatMode) return;
  selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
  refreshUI();
});

// ========== Физика с разрешением застревания ==========
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

function resolveBlockStuck() {
  const half = PLAYER.width / 2;
  const minX = Math.floor(player.pos.x - half);
  const maxX = Math.floor(player.pos.x + half);
  const minZ = Math.floor(player.pos.z - half);
  const maxZ = Math.floor(player.pos.z + half);
  const feetY = Math.floor(player.pos.y);
  const headY = Math.floor(player.pos.y + PLAYER.height - 0.2);

  let stuck = false;
  for (let y = feetY; y <= headY; y++) {
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        if (world.getBlock(x, y, z) !== AIR) {
          stuck = true;
          break;
        }
      }
    }
  }
  if (!stuck) return;

  const radius = 5;
  let bestDist = Infinity;
  let bestPos = null;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const nx = Math.floor(player.pos.x + dx);
      const nz = Math.floor(player.pos.z + dz);
      const groundY = world.terrainHeight(nx, nz);
      if (world.getBlock(nx, groundY + 1, nz) === AIR &&
          world.getBlock(nx, groundY + 2, nz) === AIR &&
          world.getBlock(nx, groundY, nz) !== AIR) {
        const dist = dx * dx + dz * dz;
        if (dist < bestDist) {
          bestDist = dist;
          bestPos = { x: nx + 0.5, y: groundY + 1, z: nz + 0.5 };
        }
      }
    }
  }

  if (bestPos) {
    player.pos.set(bestPos.x, bestPos.y, bestPos.z);
    player.vel.set(0, 0, 0);
    player.knock.set(0, 0, 0);
  } else {
    player.pos.y += 1;
  }
}

function updatePlayer(dt) {
  camera.rotation.set(pitch, yaw, 0);

  let speedMul = 1;
  const sp = effectActive('speed');
  if (sp) speedMul *= sp.power;
  if (effectActive('slow'))   speedMul *= 0.5;
  if (effectActive('freeze')) speedMul = 0;

  // Прыгучесть
  let jumpPower = JUMP_SPEED;
  if (effectActive('jump_boost')) jumpPower *= 1.5;

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
      if (keys.has('Space') && player.onGround && speedMul > 0) player.vel.y = jumpPower;
    }
    player.onGround = false;
    moveAxis(dt, 'y');
    moveAxis(dt, 'x');
    moveAxis(dt, 'z');
  }

  // Невесомость (двойной прыжок, медленное падение)
  if (effectActive('weightless')) {
    if (!player.flying && !player.onGround && player.vel.y < 0) player.vel.y *= 0.98;
    if (keys.has('Space') && !player.onGround && !player.doubleJumpUsed) {
      player.vel.y = 6;
      player.doubleJumpUsed = true;
      spawnParticles(player.pos.x, player.pos.y, player.pos.z, 0x88ff88, 10, 1, 0.5);
    }
    if (player.onGround) player.doubleJumpUsed = false;
  } else {
    player.doubleJumpUsed = false;
  }

  if (player.pos.y < -30) {
    player.pos.set(0.5, world.terrainHeight(0, 0) + 1, 0.5);
    player.vel.set(0, 0, 0);
    player.knock.set(0, 0, 0);
  }
  resolveBlockStuck();
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
    const hits = playerRaycaster.intersectObject(rp.group, true);
    if (hits.length && (!best || hits[0].distance < best.dist)) {
      best = { id, dist: hits[0].distance };
    }
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
const INV_SIZE = 37;
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

const recycleSlotDiv = document.getElementById('recycle-slot');
if (recycleSlotDiv) {
  recycleSlotDiv.addEventListener('mousedown', (e) => {
    e.preventDefault();
    clickSlot(36, e.button);
  });
}

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
  if (recycleSlotDiv) renderSlot(recycleSlotDiv, inventory[36]);
  heldEl.style.display = held ? 'block' : 'none';
  if (held) {
    heldEl.style.background = '#' + BLOCK_COLORS[held.type].getHexString();
    heldEl.querySelector('.count').textContent = held.count;
  }
}
refreshUI();

const ALL_BLOCK_TYPES = [GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, SAND, GRAVEL, COAL_ORE, IRON_ORE];
function recycleItem() {
  const slot = inventory[36];
  if (!slot) {
    addChatMessage('Система', 'Положите блок в синий слот, чтобы переработать');
    return;
  }
  const newType = ALL_BLOCK_TYPES[Math.floor(Math.random() * ALL_BLOCK_TYPES.length)];
  slot.type = newType;
  slot.count = 1;
  refreshUI();
  const pos = player.pos;
  spawnParticles(pos.x, pos.y + 1, pos.z, BLOCK_COLORS[newType].getHex(), 30, 2.5, 1.2);
  addChatMessage('Система', `Предмет превращён в ${Object.keys(BLOCK_COLORS)[newType] || 'блок'}!`);
}

const recycleBtn = document.getElementById('recycle-button');
if (recycleBtn) {
  recycleBtn.addEventListener('click', () => recycleItem());
}

function toggleInventory() {
  invOpen = !invOpen;
  invEl.classList.toggle('open', invOpen);
  if (invOpen) {
    document.exitPointerLock();
    keys.clear();
    if (spellBookOpen) closeSpellBook();
  } else {
    if (held) {
      for (let n = held.count; n > 0; n--) addItem(held.type);
      held = null;
    }
    if (!settingsOpen) renderer.domElement.requestPointerLock();
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
    // Блокируем движение, если открыта книга
    if (ready && !chatFocused && !settingsOpen && !spellBookOpen) updatePlayer(dt);
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
    updateCoordDisplay();
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);