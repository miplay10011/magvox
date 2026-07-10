import * as THREE from 'three';
import { World, buildChunkMesh, buildLODChunkMesh, AIR, BLOCK_COLORS, CHUNK_SIZE,
         GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, SAND, GRAVEL, COAL_ORE, IRON_ORE,
         ICE, SNOW_BLOCK, CACTUS,
         BRICK, OBSIDIAN, GLOWSTONE, MOSSY_STONE, SANDSTONE,
         NETHERRACK, END_STONE, PURPUR, PRISMARINE, SEA_LANTERN,
         MAGMA, SOUL_SAND, HONEY, SLIME, BAMBOO,
         CHERRY_LOG, CHERRY_LEAVES, MUSHROOM_STEM,
         RED_MUSHROOM, BROWN_MUSHROOM, CORAL, SPONGE,
         MYCELIUM, TERRACOTTA, PACKED_ICE } from './world.js';
import { Network } from './network.js';
import { createMagicEngine } from './magic.js';
import { initParticles, spawnParticles, updateParticles } from './particles.js';

// ========== Книга комбинаций (данные) ==========
const SPELL_COMBINATIONS = [
  { name: "🚀 Прыгучесть / 💨 Воздушный толчок", elements: "💨 + 💨 + 🪨", effect: "🔸 ПКМ: +50% высоты прыжка (75с) / 🔹 ЛКМ: отбрасывает врагов" },
  { name: "💚 Регенерация / 💧 Водный снаряд", elements: "💧 + ☀ + ☀", effect: "🔸 ПКМ: восстановление 1 HP/с (50с) / 🔹 ЛКМ: водяной шар (урон 6)" },
  { name: "🔥 Огнеупорность / 🔥 Огненный шар", elements: "🔥 + 🪨 + 🛡", effect: "🔸 ПКМ: сопротивление огню 50% (100с) / 🔹 ЛКМ: огненный шар (урон 10, взрыв)" },
  { name: "🔥 Огненная аура / 💥 Огненный взрыв", elements: "🔥 + 🔥 + 💨", effect: "🔸 ПКМ: аура 1 урон/с врагам (60с) / 🔹 ЛКМ: взрыв вокруг себя (урон 8)" },
  { name: "❄ Ледяная кожа / ❄ Ледяной шип", elements: "❄ + ❄ + 🪨", effect: "🔸 ПКМ: замедление атакующих (75с) / 🔹 ЛКМ: ледяной шип (урон 8)" },
  { name: "⚡ Разряд / ⚡ Молния", elements: "⚡ + 🔥 + 💨", effect: "🔸 ПКМ: 20% шанс молнии при атаке (40с) / 🔹 ЛКМ: разряд по цели (урон 8)" },
  { name: "🍃 Невесомость / 💨 Воздушный рывок", elements: "💨 + 💨 + ☀", effect: "🔸 ПКМ: медленное падение + двойной прыжок (50с) / 🔹 ЛКМ: телепорт вперёд на 12 блоков" },
  { name: "🛡 Барьер / 🪨 Земляной снаряд", elements: "🛡 + 🪨", effect: "🔸 ПКМ: щит 4 ед. (75с) / 🔹 ЛКМ: земляной шар (урон 8)" },
  { name: "🪨 Каменная кожа / ❄ Ледяной шип", elements: "🛡 + ❄", effect: "🔸 ПКМ: +броня (8с) / 🔹 ЛКМ: ледяной шип (урон 6, замедление)" },
  { name: "💚 Лечение / ☀ Световой снаряд", elements: "☀ + ☀", effect: "🔸 ПКМ: снятие дебаффов, лечение 3×кол-во света / 🔹 ЛКМ: световой снаряд (урон 6)" },
  { name: "💨 Ускорение / 💨 Воздушная волна", elements: "💨 + 💨", effect: "🔸 ПКМ: +60% скорости (3+2×n(air)с) / 🔹 ЛКМ: отбрасывание врагов" },
  { name: "🕊 Левитация / ☀ Световой толчок", elements: "💨 + ☀", effect: "🔸 ПКМ: левитация (медленное падение) / 🔹 ЛКМ: толчок (отбрасывание)" },
  { name: "🌫️ Ослепление / 🛡 Ослепляющий щит", elements: "☀ + 💧 + 💨", effect: "🔹 ЛКМ: слепота врагов в радиусе 5 (15с) / 🔸 ПКМ: слабая слепота + щит 2 ед." },
  { name: "🌑 Теневой шаг / 🌑 Теневая вуаль", elements: "🌑 + 🌑 + 💨", effect: "🔹 ЛКМ: телепорт за спину / 🔸 ПКМ: невидимость + скорость (8с)" },
  { name: "⛓️ Цепочка послушания / 🔥 Огненная цепь", elements: "🌑 + ⚡ + 🔥", effect: "🔹 ЛКМ: связь цепью (50% передачи урона) / 🔸 ПКМ: урон 6 + поджог цели" },
  { name: "🔄 Обмен местами / 🐌 Замедление", elements: "🌑 + 💨 + 🪨", effect: "🔹 ЛКМ: обмен позициями / 🔸 ПКМ: замедление цели (5с)" },
  { name: "💣 Мина / ⏳ Теневая ловушка", elements: "🛡 + 🌑", effect: "🔹 ЛКМ: мина (взрыв при приближении) / 🔸 ПКМ: зона замедления времени (радиус 4, 6с)" },
  { name: "🌀 Телепортация / 🌑 Теневое уклонение", elements: "💨 + 🌑", effect: "🔹 ЛКМ: телепорт вперёд / 🔸 ПКМ: рывок назад" },
  { name: "🛡 Сфера защиты / 💥 Природный взрыв", elements: "🛡 + 🪨 + 💨 + 💧 + ☀", effect: "🔸 ПКМ: непробиваемая сфера (лечение + отражение 50%) / 🔹 ЛКМ: взрыв радиус 5, урон 18 + 🌫️ Ослепление" },
  { name: "☄️ Астероид / 🌑 Тёмный щит", elements: "🔥 + 🪨 + 🌑 + ⚡ + 💨", effect: "🔹 ЛКМ: падающий астероид (взрыв, воронка) / 🔸 ПКМ: щит 12 ед. (15с)" },
  { name: "⏳ Вечный лёд разума / ❄ Ледяная броня", elements: "❄ + 💧 + 🪨 + 🌑 + ☀", effect: "🔹 ЛКМ: зона замедления времени (радиус 5, 15с) / 🔸 ПКМ: +броня (12с)" },
  { name: "🐦‍🔥 Феникс / 🔥 Огненный удар", elements: "🔥 + ☀ + 💨 + 🪨 + 🛡", effect: "🔸 ПКМ: возрождение при HP<4 (1 раз) / 🔹 ЛКМ: взрыв вокруг (урон 10)" },
  { name: "🌋 Громокаменный топот / 🧱 Каменная стена", elements: "🪨 + 💨 + 🔥 + ⚡ + 🛡", effect: "🔹 ЛКМ: ударная волна (подбрасывает, урон 8) / 🔸 ПКМ: каменная стена (3 блока шириной)" },
  { name: "🌪️ Чёрный вихрь / 🌑 Тёмное лечение", elements: "🌑 + 💨 + 💧 + 🪨 + ⚡", effect: "🔹 ЛКМ: торнадо (периодический урон 8с) / 🔸 ПКМ: лечение 10 HP" },
  { name: "🔒 Световая клетка / ✨ Световой барьер", elements: "☀ + ⚡ + 💨 + 🪨 + 🔥", effect: "🔹 ЛКМ: клетка (урон разрядами каждую сек) / 🔸 ПКМ: щит 6 ед. союзнику (10с)" },
  { name: "⛓️ Теневые оковы / 🧊 Ледяная глыба", elements: "🌑 + ❄ + 🪨 + 💨 + 💧", effect: "🔹 ЛКМ: оковы (цель не поворачивается) / 🔸 ПКМ: ледяная стена вокруг цели" },
  { name: "🐉 Дыхание дракона / 🛡 Драконья чешуя", elements: "🔥 + 🌑 + 💨 + 🪨 + ❄", effect: "🔹 ЛКМ: метеор (взрыв, урон 14+2×len) / 🔸 ПКМ: сопротивления (огонь + камень, 30с)" },
  { name: "🔋 Электрический тотем / ⚡ Мгновенный тотем", elements: "🪨 + ⚡ + 💨", effect: "🔹 ЛКМ: тотем (ускорение + зарядка оружия) / 🔸 ПКМ: тотем сразу на месте (меньше длительность)" },
  { name: "☄️ Метеор / 🛡 Метеоритный щит", elements: "⚡ + 🔥 + 🪨", effect: "🔹 ЛКМ: падающий взрывной метеор / 🔸 ПКМ: щит 8 ед. (15с)" },
  { name: "🎯 Обычный снаряд / 🛡 Защита", elements: "любая комбинация (кроме 🛡/⚡)", effect: "🔹 ЛКМ: снаряд (урон от элементов) / 🔸 ПКМ: мгновенный щит или лечение" },
  { name: "💨 Паровая волна / 💚 Очищающий пар", elements: "🔥 + 💧", effect: "🔹 ЛКМ: отбрасывание + урон 4 / 🔸 ПКМ: снятие 🔥 Горение и ❄ Заморозки + 💚 Регенерация (5с)" },
  { name: "💧 Водяной разрез / 🕊 Воздушный карман", elements: "💧 + 💨", effect: "🔹 ЛКМ: снаряд с 🐌 Замедлением / 🔸 ПКМ: 🕊 Левитация + 💨 Ускорение (5с)" },
  { name: "🪨 Каменный шквал / 🧱 Земляная стена", elements: "🪨 + 💨", effect: "🔹 ЛКМ: снаряд + взрыв / 🔸 ПКМ: маленькая стена (3 блока)" },
  { name: "💨 Паровой снаряд / 🌡️ Терморегуляция", elements: "❄ + 🔥", effect: "🔹 ЛКМ: снаряд (🔥 Горение + 🐌 Замедление) / 🔸 ПКМ: снятие 🔥 и ❄ + 🛡 Барьер 3 ед." },
  { name: "🌀 Хаотический снаряд / ⚖️ Равновесие", elements: "☀ + 🌑", effect: "🔹 ЛКМ: случайный эффект (🔥/❄/🌑 Проклятие/🌫️ Ослепление) / 🔸 ПКМ: 💚 Лечение 6 + 🛡 2 ед." },
  { name: "💧 Водяная мина / 💧 Водный щит", elements: "🛡 + 💧", effect: "🔹 ЛКМ: мина (взрыв) / 🔸 ПКМ: 💚 Регенерация + 🔥 Огнеупорность (8с)" },
  { name: "💨 Воздушный толчок / 🛡 Щит ветра", elements: "🛡 + 💨", effect: "🔹 ЛКМ: отбрасывание / 🔸 ПКМ: 💨 Ускорение + 🛡 2 ед. (6с)" },
  { name: "☀ Световой клинок / ✨ Священный щит", elements: "🛡 + ☀", effect: "🔹 ЛКМ: снаряд (лечит кастера) / 🔸 ПКМ: снятие 🌑 Проклятия + 🛡 6 ед. (12с)" },
  { name: "🌑 Теневой плащ (мина)", elements: "🛡 + 🌑", effect: "🔹 ЛКМ: 💣 Мина / 🔸 ПКМ: 🌫️ Ослепление врагов + 💨 Ускорение себе" },
  { name: "☁️ Облако пара / 🛡 Паровой щит", elements: "🔥 + 💧 + 💨", effect: "🔹 ЛКМ: зона урона (3 HP) + лечение кастера (5) / 🔸 ПКМ: 🔥 Огнеупорность + ❄ Ледяная кожа" },
  { name: "🌋 Вулканическая бомба / 🪨 Магма-броня", elements: "🔥 + 🪨 + 🌑", effect: "🔹 ЛКМ: снаряд (радиус 3.5, урон 12, 🔥 Горение) / 🔸 ПКМ: 🪨 Каменная кожа + 🔥 Огненная аура" },
  { name: "❄ Ледяная стрела / 💚 Светлое исцеление", elements: "💧 + ❄ + ☀", effect: "🔹 ЛКМ: снаряд (❄ Заморозка 2с) / 🔸 ПКМ: снятие дебаффов + 💚 Лечение 8" },
  { name: "⚡ Электрический разряд / 🛡 Заземление", elements: "💨 + 🪨 + ⚡", effect: "🔹 ЛКМ: цепная молния (урон 10, перескок) / 🔸 ПКМ: 🛡 Барьер 3 ед." },
  { name: "🌑 Чёрная вода / 🌙 Лунная вода", elements: "🌑 + ☀ + 💧", effect: "🔹 ЛКМ: снаряд (🌑 Проклятие + 🌫️ Ослепление) / 🔸 ПКМ: снятие 🌑 + 💚 Лечение 12" },
  { name: "🌩️ Шторм / 🛡 Защита стихий", elements: "🔥 + 💧 + 💨 + 🪨", effect: "🔹 ЛКМ: массовый урон 8 + 🐌 Замедление + 🔥 Горение / 🔸 ПКМ: 🔥 Огнеупорность + ❄ Ледяная кожа + 🛡 4 ед." },
  { name: "✨ Карающий луч / 🛡 Абсолютная защита", elements: "☀ + 🌑 + ⚡ + 🛡", effect: "🔹 ЛКМ: сильный луч (урон 20) / 🔸 ПКМ: 🛡 12 ед. + 💚 Регенерация" },
  { name: "⚖️ Взрыв контраста / ⚖️ Баланс", elements: "🔥 + ❄ + 💨 + 🪨", effect: "🔹 ЛКМ: взрыв (урон 7, случайный 🔥/❄) / 🔸 ПКМ: снятие 🔥 и ❄ + 🛡 5 ед." },
  { name: "☄️ Метеоритный дождь / 🔥 Абсолютное пламя", elements: "🔥 + 🔥 + 🔥 + 🔥 + 🔥", effect: "🔹 ЛКМ: 5 метеоров с неба / 🔸 ПКМ: 🔥 Огненная аура (2 урона/с, радиус 4)" },
  { name: "🌊 Цунами / 💧 Аква-щит", elements: "💧 + 💧 + 💧 + 💧 + 💧", effect: "🔹 ЛКМ: отбрасывание + урон 12 / 🔸 ПКМ: 💚 Регенерация (3 HP/с, 20с)" },
  { name: "🌋 Землетрясение / 🧱 Непробиваемая стена", elements: "🪨 + 🪨 + 🪨 + 🪨 + 🪨", effect: "🔹 ЛКМ: 🌋 Громокаменный топот (радиус 6) / 🔸 ПКМ: большая стена (7 блоков)" },
  { name: "🌪️ Ураган / 🕊 Полёт", elements: "💨 + 💨 + 💨 + 💨 + 💨", effect: "🔹 ЛКМ: отбрасывание всех в радиусе 8 / 🔸 ПКМ: 🕊 Левитация + 💨 Ускорение ×2 (15с)" },
  { name: "❄ Глобальное замораживание / 🧊 Ледяная тюрьма", elements: "❄ + ❄ + ❄ + ❄ + ❄", effect: "🔹 ЛКМ: ❄ Заморозка всех в радиусе 8 (5с) / 🔸 ПКМ: стена вокруг цели" },
  { name: "🌿 Природный взрыв / 🐦‍🔥 Феникс", elements: "🔥 + 💧 + 🪨 + 💨 + ☀", effect: "🔹 ЛКМ: взрыв (радиус 5, урон 18) + 🌫️ Ослепление / 🔸 ПКМ: 🐦‍🔥 Феникс + 💚 Лечение 15" },
  { name: "🌑 Тёмная зима / ❄ Ледяной дождь", elements: "🌑 + ❄ + 💧 + 🪨 + ⚡", effect: "🔹 ЛКМ: 🌪️ Чёрный вихрь + ❄ Заморозка / 🔸 ПКМ: ⏳ Замедление времени (радиус 6, 12с) + 💚 Лечение 8" },
  { name: "☀ Небесный луч / ✨ Небесный щит", elements: "☀ + 🔥 + 💨 + ⚡ + 🛡", effect: "🔹 ЛКМ: мощный луч / 🔸 ПКМ: 🛡 10 ед. + 💚 Регенерация + 🔥 Огнеупорность" },
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
        if (!invOpen && document.pointerLockElement !== renderer.domElement && !chatFocused && !isMobile) {
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
  if (!invOpen && !settingsOpen && !chatFocused && !isMobile) {
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
const FULL_RADIUS = 12;
const dirtyChunks = new Set();

// ========== LOD superchunks ==========
const LOD_SUPER_SCALE = 4;
const LOD_SUPER_RADIUS = 12;
const LOD_BUDGET = 8;
const lodMeshes = new Map();

function remeshChunk(chunk) {
  if (!chunk || !chunk.dirty) return;
  if (chunk.mesh) { scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
  chunk.mesh = buildChunkMesh(world, chunk);
  scene.add(chunk.mesh);
  chunk.dirty = false;
}

function startWorld(seed, edits = []) {
  world = new World(seed);
  for (const [key, t] of edits) world.edits.set(key, t);
  player.pos.set(0.5, world.terrainHeight(0, 0) + 1, 0.5);
  player.vel.set(0, 0, 0);
  for (const [key, mesh] of lodMeshes) {
    scene.remove(mesh); mesh.geometry.dispose();
  }
  lodMeshes.clear();
  chunkManagerTick();
}

function chunkManagerTick() {
  if (!world) return;
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
  const pcz = Math.floor(player.pos.z / CHUNK_SIZE);

  let dirtyBudget = 4;
  for (const chunk of dirtyChunks) {
    if (dirtyBudget-- <= 0) break;
    dirtyChunks.delete(chunk);
    remeshChunk(chunk);
  }

  const wantFull = new Set();
  for (let dx = -FULL_RADIUS; dx <= FULL_RADIUS; dx++)
    for (let dz = -FULL_RADIUS; dz <= FULL_RADIUS; dz++)
      wantFull.add(world.key(pcx + dx, pcz + dz));

  const toDelete = [];
  for (const [key, c] of world.chunks)
    if (!wantFull.has(key)) toDelete.push([key, c]);
  for (const [key, c] of toDelete) {
    if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
    dirtyChunks.delete(c);
    world.chunks.delete(key);
  }

  const missing = [];
  for (let dx = -FULL_RADIUS; dx <= FULL_RADIUS; dx++)
    for (let dz = -FULL_RADIUS; dz <= FULL_RADIUS; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (!world.getChunk(cx, cz))
        missing.push([cx, cz, dx * dx + dz * dz]);
    }
  missing.sort((a, b) => a[2] - b[2]);

  let genBudget = 4;
  for (const [cx, cz] of missing) {
    if (genBudget-- <= 0) break;
    const chunk = world.generateChunk(cx, cz);
    chunk.dirty = true;
    remeshChunk(chunk);
    for (const [nx, nz] of [[cx+1,cz],[cx-1,cz],[cx,cz+1],[cx,cz-1]]) {
      const nb = world.getChunk(nx, nz);
      if (nb) { nb.dirty = true; dirtyChunks.add(nb); }
    }
  }
}

setInterval(chunkManagerTick, 40);

function lodManagerTick() {
  if (!world) return;
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
  const pcz = Math.floor(player.pos.z / CHUNK_SIZE);

  const superPlayerCx = Math.floor(pcx / LOD_SUPER_SCALE);
  const superPlayerCz = Math.floor(pcz / LOD_SUPER_SCALE);

  const wantLod = new Set();

  const fullMinX = pcx - FULL_RADIUS;
  const fullMaxX = pcx + FULL_RADIUS;
  const fullMinZ = pcz - FULL_RADIUS;
  const fullMaxZ = pcz + FULL_RADIUS;

  for (let dsx = -LOD_SUPER_RADIUS; dsx <= LOD_SUPER_RADIUS; dsx++) {
    for (let dsz = -LOD_SUPER_RADIUS; dsz <= LOD_SUPER_RADIUS; dsz++) {
      const scx = superPlayerCx + dsx;
      const scz = superPlayerCz + dsz;

      const minCx = scx * LOD_SUPER_SCALE;
      const maxCx = minCx + LOD_SUPER_SCALE - 1;
      const minCz = scz * LOD_SUPER_SCALE;
      const maxCz = minCz + LOD_SUPER_SCALE - 1;

      const isInside = (minCx >= fullMinX && maxCx <= fullMaxX && minCz >= fullMinZ && maxCz <= fullMaxZ);
      if (isInside) continue;

      wantLod.add(`${scx},${scz}`);
    }
  }

  for (const [key, mesh] of lodMeshes) {
    if (!wantLod.has(key)) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      lodMeshes.delete(key);
    }
  }

  let lodGen = LOD_BUDGET;
  for (const key of wantLod) {
    if (lodMeshes.has(key)) continue;
    if (lodGen-- <= 0) break;
    const [scx, scz] = key.split(',').map(Number);
    const mesh = buildLODChunkMesh(world, scx, scz);
    if (mesh) {
      lodMeshes.set(key, mesh);
      scene.add(mesh);
    }
  }
}

setInterval(lodManagerTick, 100);

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
  chaos: 0xaa44ff, dragon_fireball: 0xff6633,
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
const remotePlayers = new Map();

// ========== Создание модели игрока ==========
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
function createMobModel(mobType, color, width, height) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2 });
  // Сохраним материал для вспышки
  group.userData.material = mat;

  // Размеры будут заданы через масштабирование или геометрию
  // Для простоты используем куб с разными пропорциями
  let bodyGeo, headGeo;
  switch (mobType) {
    case 'zombie':
      bodyGeo = new THREE.BoxGeometry(width * 0.8, height * 0.6, width * 0.6);
      headGeo = new THREE.BoxGeometry(width * 0.6, height * 0.3, width * 0.6);
      break;
    case 'skeleton':
      bodyGeo = new THREE.BoxGeometry(width * 0.7, height * 0.7, width * 0.5);
      headGeo = new THREE.BoxGeometry(width * 0.5, height * 0.25, width * 0.5);
      break;
    case 'slime':
      bodyGeo = new THREE.SphereGeometry(width * 0.5, 12, 12);
      headGeo = null;
      break;
    case 'ghost':
      bodyGeo = new THREE.SphereGeometry(width * 0.5, 12, 12);
      headGeo = new THREE.SphereGeometry(width * 0.3, 8, 8);
      break;
    default:
      bodyGeo = new THREE.BoxGeometry(width, height, width);
      headGeo = null;
  }

  const body = new THREE.Mesh(bodyGeo, mat);
  body.position.y = height * 0.5;
  group.add(body);
  group.userData.body = body;

  if (headGeo) {
    const headMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, 0.1) });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = height * 0.9;
    group.add(head);
    group.userData.head = head;
  }

  // Добавим глаза для выразительности (опционально)
  if (mobType !== 'slime' && mobType !== 'ghost') {
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const pupilGeo = new THREE.SphereGeometry(0.04, 6, 6);
    for (let side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.2, height * 0.9, width * 0.45);
      group.add(eye);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.set(side * 0.22, height * 0.9, width * 0.48);
      group.add(pupil);
    }
  }

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
function flashMobModel(ent, duration = 200) {
  if (!ent || !ent.mesh) return;
  const mesh = ent.mesh;
  // Если это группа (моб), проходим по всем дочерним мешам
  const children = mesh.children || [mesh];
  const originalColors = [];
  // Сохраняем оригинальные цвета, если ещё не сохранили
  if (!mesh.userData._flashColors) {
    mesh.userData._flashColors = [];
    children.forEach(child => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const colors = mats.map(m => m.color.clone());
        mesh.userData._flashColors.push({ child, colors });
      }
    });
  }
  // Устанавливаем красный
  children.forEach(child => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => m.color.setHex(0xff0000));
    }
  });
  // Возврат через duration
  if (mesh.userData._flashTimer) clearTimeout(mesh.userData._flashTimer);
  mesh.userData._flashTimer = setTimeout(() => {
    const flashData = mesh.userData._flashColors;
    if (flashData) {
      flashData.forEach(({ child, colors }) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m, i) => {
            if (colors[i]) m.color.copy(colors[i]);
          });
        }
      });
    }
    mesh.userData._flashTimer = null;
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
  blockUpdate: (m) => {
    if (!world) return;
    const dirty = world.setBlock(m.x, m.y, m.z, m.t);
    dirty.forEach(c => { c.dirty = true; dirtyChunks.add(c); remeshChunk(c); });
  },
  blocksUpdate: (m) => {
    if (!world) return;
    const dirtySet = new Set();
    for (const b of m.blocks) {
      world.setBlock(b.x, b.y, b.z, b.t).forEach(c => dirtySet.add(c));
    }
    let i = 0;
    dirtySet.forEach(c => {
      if (i++ < 4) { c.dirty = true; remeshChunk(c); }
      else { c.dirty = true; dirtyChunks.add(c); }
    });
  },
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

  // ========== СОБЫТИЯ СУЩНОСТЕЙ ==========
  entitySpawn: (m) => {
    console.log('entitySpawn raw data:', m);
    createEntityFromData(m);
  },
  entityUpdate: (m) => {
  const ent = remoteEntities.get(m.id);
  if (!ent) return;
  // Обновляем целевую позицию (центр меша) с учётом высоты
  ent.targetPos.set(m.x, m.y + ent.height / 2, m.z);
  if (m.yaw !== undefined) ent.targetYaw = m.yaw;
  if (m.pitch !== undefined) ent.targetPitch = m.pitch;
},
  entityDespawn: (m) => {
  const ent = remoteEntities.get(m.id);
  if (!ent) return;
  const mesh = ent.mesh;
  // Если это группа (моб), удаляем все дочерние меши
  if (mesh.isGroup) {
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(mat => mat.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    scene.remove(mesh);
  } else {
    // Обычный меш
    scene.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }
  remoteEntities.delete(m.id);
},
  entityHp: (m) => {
    const ent = remoteEntities.get(m.id);
    if (ent) {
      flashMobModel(ent, 300); // мигаем красным
      // Можно добавить частицы
      const pos = ent.mesh.position;
      spawnParticles(pos.x, pos.y + 0.5, pos.z, 0xff3333, 15, 1.5, 0.8);
    }
  },  
};
for (const [t, f] of Object.entries(EVENTS)) net.on(t, f);

let blindnessOverlay = null;
function setBlindness(active) {
  if (!blindnessOverlay) {
    blindnessOverlay = document.createElement('div');
    blindnessOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,200,0.7); pointer-events:none; z-index:1000; display:none;';
    document.body.appendChild(blindnessOverlay);
  }
  blindnessOverlay.style.display = active ? 'block' : 'none';
}

let shieldMesh = null;

// ========== Хранилище сущностей ==========
const remoteEntities = new Map();

// ========== ИСПРАВЛЕННАЯ ФУНКЦИЯ СОЗДАНИЯ СУЩНОСТИ ==========
function createEntityFromData(data) {
  const info = data.data || {};
  let mobType = info.mobType;
  // Если mobType не определён, определяем по другим параметрам (fallback)
  if (!mobType) {
    if (info.slimeSize && info.slimeSize > 0) mobType = 'slime';
    else if (info.gravity === 0) mobType = 'ghost';
    else if (info.damageDistance && info.damageDistance > 3) mobType = 'skeleton';
    else mobType = 'zombie';
  }
  // Дефолтные цвета и размеры
  const defaultColors = {
    zombie: 0x44aa44,
    skeleton: 0xcccccc,
    ghost: 0x88aaff,
    slime: 0x88dd88,
  };
  const defaultSizes = {
    zombie: { width: 0.6, height: 1.8 },
    skeleton: { width: 0.6, height: 1.8 },
    ghost: { width: 0.6, height: 1.8 },
    slime: { width: 0.6, height: 0.6 },
  };
  const color = info.color ?? defaultColors[mobType] ?? 0x44aaff;
  const defSize = defaultSizes[mobType] || { width: 0.6, height: 0.6 };
  const width = info.width ?? defSize.width;
  const height = info.height ?? defSize.height;

  console.log(`[Entity] ID: ${data.id}, type: ${mobType}, size: ${width}x${height}, color: ${color.toString(16)}`);

  let mesh;
  if (data.type === 'mob') {
    mesh = createMobModel(mobType, color, width, height);
  } else {
    const geo = new THREE.BoxGeometry(width, height, width);
    const mat = new THREE.MeshStandardMaterial({ color });
    mesh = new THREE.Mesh(geo, mat);
  }

  const centerY = data.y + height / 2;
  mesh.position.set(data.x, centerY, data.z);
  mesh.rotation.y = data.yaw || 0;
  mesh.rotation.x = data.pitch || 0;
  scene.add(mesh);

  remoteEntities.set(data.id, {
    mesh,
    targetPos: new THREE.Vector3(data.x, centerY, data.z),
    targetYaw: data.yaw || 0,
    targetPitch: data.pitch || 0,
    height: height,
    mobType: mobType,
    color: color,
    isMob: data.type === 'mob',
  });
}

function updateRemoteEntities(dt) {
  const k = 1 - Math.pow(0.0001, dt);
  for (const ent of remoteEntities.values()) {
    ent.mesh.position.lerp(ent.targetPos, k);
    ent.mesh.rotation.y += (ent.targetYaw - ent.mesh.rotation.y) * k;
    ent.mesh.rotation.x += (ent.targetPitch - ent.mesh.rotation.x) * k;
  }
}

// ========== Raycast для игроков и сущностей ==========
function raycastEntities(maxDist) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const raycaster = new THREE.Raycaster(camera.position, dir, 0, maxDist);

  let best = null;

  // Проверяем игроков
  for (const [id, rp] of remotePlayers) {
    const hits = raycaster.intersectObject(rp.group, true);
    if (hits.length && (!best || hits[0].distance < best.dist)) {
      best = { type: 'player', id, dist: hits[0].distance };
    }
  }

  // Проверяем сущности (мобов)
  for (const [id, ent] of remoteEntities) {
    if (!ent.mesh) continue;
    const hits = raycaster.intersectObject(ent.mesh, true);
    if (hits.length && (!best || hits[0].distance < best.dist)) {
      best = { type: 'entity', id, dist: hits[0].distance };
    }
  }

  return best;
}

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
  if (m.entities) {
    for (const e of m.entities) createEntityFromData(e);
  }
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
  if (activeEffects.has('disorient')) {
    document.body.style.transform = 'rotate(180deg)';
    setTimeout(() => document.body.style.transform = '', 6000);
  }
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
  if (activeEffects.has('shadow_shackles')) {
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
net.on('entityUpdate', (m) => {
  const ent = remoteEntities.get(m.id);
  if (!ent) return;
  // Защита от отсутствия height
  const h = ent.height || 0.6;
  ent.targetPos.set(m.x, m.y + h / 2, m.z);
  if (m.yaw !== undefined) ent.targetYaw = m.yaw;
  if (m.pitch !== undefined) ent.targetPitch = m.pitch;
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
        // Отправляем команду на сервер для обработки
        net.send('chat', { message: message });
        // Не добавляем сообщение локально — сервер вернёт ответ через systemMessage
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

// ========== Оффлайн-магия (batch setBlock для взрывов) ==========
let localMagic = null;
let offlineBlockBatch = [];
let offlineBlockTimer = null;

function flushOfflineBlocks() {
  const updates = offlineBlockBatch;
  offlineBlockBatch = [];
  if (!updates.length || !world) { offlineBlockTimer = null; return; }
  const dirtySet = new Set();
  for (const [x, y, z, t] of updates) {
    world.setBlock(x, y, z, t).forEach(c => dirtySet.add(c));
  }
  dirtySet.forEach(c => { c.dirty = true; dirtyChunks.add(c); remeshChunk(c); });
  offlineBlockTimer = null;
}

function makeLocalCtx() {
  return {
    getBlock: (x, y, z) => world.getBlock(x, y, z),
    setBlock: (x, y, z, t) => {
      offlineBlockBatch.push([x, y, z, t]);
      if (offlineBlockTimer) clearTimeout(offlineBlockTimer);
      offlineBlockTimer = setTimeout(flushOfflineBlocks, 0);
    },
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

function castSpell(hand = 'left') {
  if (!spellQueue.length) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  if (net.connected) {
    net.send('cast', { elements: [...spellQueue], dir: [dir.x, dir.y, dir.z], hand });
  } else {
    if (!localMagic) localMagic = createMagicEngine(makeLocalCtx());
    localMagic.cast('me', [...spellQueue], [dir.x, dir.y, dir.z],
      { x: camera.position.x, y: camera.position.y, z: camera.position.z }, yaw, hand);
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

// ========== Мобильное управление ==========
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const mobileKeys = {};
function isKeyDown(code) {
  return keys.has(code) || !!mobileKeys[code];
}

let joyActive = false;
let joyId = null;
let joyBase = { x: 0, y: 0 };
let joyPos = { x: 0, y: 0 };
const joyArea = document.getElementById('joy-area');
const joyStick = document.getElementById('joy-stick');

function handleJoyStart(e) {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joyActive = true;
  joyId = touch.identifier;
  const rect = joyArea.getBoundingClientRect();
  joyBase.x = rect.left + rect.width / 2;
  joyBase.y = rect.top + rect.height / 2;
  updateJoyPos(touch.clientX, touch.clientY);
}
function handleJoyMove(e) {
  e.preventDefault();
  if (!joyActive) return;
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i];
    if (t.identifier === joyId) {
      updateJoyPos(t.clientX, t.clientY);
      break;
    }
  }
}
function handleJoyEnd(e) {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joyId) {
      joyActive = false;
      joyId = null;
      updateJoyPos(joyBase.x, joyBase.y);
      mobileKeys['KeyW'] = false;
      mobileKeys['KeyS'] = false;
      mobileKeys['KeyA'] = false;
      mobileKeys['KeyD'] = false;
      break;
    }
  }
}
function updateJoyPos(cx, cy) {
  const maxR = 50;
  let dx = cx - joyBase.x;
  let dy = cy - joyBase.y;
  const dist = Math.hypot(dx, dy);
  if (dist > maxR) {
    dx = dx / dist * maxR;
    dy = dy / dist * maxR;
  }
  joyPos.x = dx / maxR;
  joyPos.y = dy / maxR;
  joyStick.style.left = (35 + dx * 0.9) + 'px';
  joyStick.style.top = (35 + dy * 0.9) + 'px';
  
  mobileKeys['KeyW'] = dy < -0.3;
  mobileKeys['KeyS'] = dy > 0.3;
  mobileKeys['KeyA'] = dx < -0.3;
  mobileKeys['KeyD'] = dx > 0.3;
}

joyArea.addEventListener('touchstart', handleJoyStart, { passive: false });
joyArea.addEventListener('touchmove', handleJoyMove, { passive: false });
joyArea.addEventListener('touchend', handleJoyEnd);
joyArea.addEventListener('touchcancel', handleJoyEnd);

let camTouchId = null;
let lastCamTouch = { x: 0, y: 0 };

function onTouchStart(e) {
  if (invOpen || settingsOpen || spellBookOpen) return;
  for (const t of e.changedTouches) {
    if (t.target.closest('.element-icon')) return;
    if (t.target === renderer.domElement || t.target === document.body) {
      if (camTouchId === null) {
        camTouchId = t.identifier;
        lastCamTouch.x = t.clientX;
        lastCamTouch.y = t.clientY;
      }
    }
  }
}
function onTouchMove(e) {
  if (camTouchId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier === camTouchId) {
      const dx = t.clientX - lastCamTouch.x;
      const dy = t.clientY - lastCamTouch.y;
      yaw -= dx * SENS;
      pitch -= dy * SENS;
      const lim = Math.PI / 2 - 0.01;
      pitch = Math.max(-lim, Math.min(lim, pitch));
      lastCamTouch.x = t.clientX;
      lastCamTouch.y = t.clientY;
      break;
    }
  }
}
function onTouchEnd(e) {
  for (const t of e.changedTouches) {
    if (t.identifier === camTouchId) {
      camTouchId = null;
      break;
    }
  }
}

document.addEventListener('touchstart', onTouchStart, { passive: false });
document.addEventListener('touchmove', onTouchMove, { passive: false });
document.addEventListener('touchend', onTouchEnd);
document.addEventListener('touchcancel', onTouchEnd);

// Кнопки действий
function bindMobileButton(id, action) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    action();
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    action();
  });
}

bindMobileButton('btn-jump', () => { mobileKeys['Space'] = true; setTimeout(() => mobileKeys['Space'] = false, 100); });
bindMobileButton('btn-fly', () => { player.flying = !player.flying; player.vel.set(0,0,0); addChatMessage('Система', player.flying ? 'Полёт вкл' : 'Полёт выкл'); });
bindMobileButton('btn-attack', () => {
  if (!combatMode) return;
  if (spellQueue.length) castSpell('left');
  else {
    const target = raycastEntities(4.5);
    if (target) {
      if (target.type === 'player') net.send('attack', { target: target.id });
      else if (target.type === 'entity') net.send('attackEntity', { entityId: target.id });
    }
  }
});
bindMobileButton('btn-descend', () => {
  mobileKeys['ShiftLeft'] = true;
});
const descendBtn = document.getElementById('btn-descend');
if (descendBtn) {
  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(ev => {
    descendBtn.addEventListener(ev, () => { mobileKeys['ShiftLeft'] = false; });
  });
}

bindMobileButton('btn-inventory', () => toggleInventory());
bindMobileButton('btn-book', () => openSpellBook());
bindMobileButton('btn-chat', () => { chatInput.focus(); chatInput.value = ''; });
bindMobileButton('btn-settings', () => { toggleSettings(true); });
bindMobileButton('btn-combat', () => { combatMode = !combatMode; spellQueue.length = 0; refreshQueueUI(); ringEl.classList.toggle('combat', combatMode); });
bindMobileButton('btn-break', () => {
  if (combatMode) {
    const target = raycastEntities(4.5);
    if (target) {
      if (target.type === 'player') net.send('attack', { target: target.id });
      else if (target.type === 'entity') net.send('attackEntity', { entityId: target.id });
    }
    else if (spellQueue.length) castSpell('left');
  } else {
    const hit = raycastBlock(5);
    if (!hit) return;
    const [x,y,z] = hit.block;
    addItem(world.getBlock(x,y,z));
    const dirty = world.setBlock(x,y,z,AIR);
    dirty.forEach(c => c.dirty = true);
    dirty.forEach(remeshChunk);
    net.send('setBlock', {x,y,z,t:AIR});
  }
});
bindMobileButton('btn-place', () => {
  if (combatMode) {
    if (spellQueue.length) castSpell('right');
  } else {
    const hit = raycastBlock(5);
    if (!hit?.prev) return;
    const slot = inventory[selectedSlot];
    if (!slot) return;
    const [x,y,z] = hit.prev;
    if (intersectsPlayer(x,y,z)) return;
    const dirty = world.setBlock(x,y,z,slot.type);
    dirty.forEach(c => c.dirty = true);
    dirty.forEach(remeshChunk);
    net.send('setBlock', {x,y,z,t:slot.type});
    if (--slot.count <= 0) inventory[selectedSlot] = null;
    refreshUI();
  }
});

// Кликабельное кольцо стихий и прочие мобильные дополнения
if (isMobile) {
  iconEls.forEach((el, i) => {
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (combatMode) addElement(i);
      else { selectedSlot = i; refreshUI(); }
    });
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (combatMode) addElement(i);
      else { selectedSlot = i; refreshUI(); }
    });
  });

  const closeInvBtn = document.getElementById('close-inv-btn');
  if (closeInvBtn) {
    closeInvBtn.style.display = 'block';
    closeInvBtn.addEventListener('click', () => toggleInventory());
  }

  const origOpenSpellBook = openSpellBook;
  openSpellBook = function() {
    origOpenSpellBook();
    if (!spellBookElement) return;
    let closeBtn = spellBookElement.querySelector('.close-book-btn');
    if (!closeBtn) {
      closeBtn = document.createElement('button');
      closeBtn.textContent = '✕';
      closeBtn.className = 'close-book-btn';
      closeBtn.style.cssText = 'position:absolute; top:5px; right:5px; background:#555; color:white; border:none; border-radius:50%; width:30px; height:30px; font-size:16px; cursor:pointer;';
      closeBtn.addEventListener('click', closeSpellBook);
      spellBookElement.appendChild(closeBtn);
    }
  };
}

// ========== Управление мышью/клавиатурой (десктоп) ==========
renderer.domElement.addEventListener('click', () => {
  if (!invOpen && !isMobile) renderer.domElement.requestPointerLock();
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
  // Команда для создания сущности (опционально)
  if (e.code === 'KeyG' && !chatFocused && !settingsOpen && !spellBookOpen) {
    e.preventDefault();
    net.send('spawnEntity', {});
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
document.addEventListener('wheel', (e) => {
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

  let jumpPower = JUMP_SPEED;
  if (effectActive('jump_boost')) jumpPower *= 1.5;

  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right   = new THREE.Vector3( Math.cos(yaw), 0, -Math.sin(yaw));
  const wish = new THREE.Vector3();
  if (isKeyDown('KeyW')) wish.add(forward);
  if (isKeyDown('KeyS')) wish.sub(forward);
  if (isKeyDown('KeyD')) wish.add(right);
  if (isKeyDown('KeyA')) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize();

  let isOnIce = false;
  const blockUnder = world.getBlock(Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z));
  if (blockUnder === ICE || blockUnder === PACKED_ICE) isOnIce = true;

  let walkSpeed = WALK_SPEED;
  let decay = 0.03;
  if (isOnIce) {
    walkSpeed *= 1.5;
    decay = 0.01;
  }
  walkSpeed *= speedMul;

  if (player.flying) {
    if (isKeyDown('Space'))     wish.y += 1;
    if (isKeyDown('ShiftLeft')) wish.y -= 1;
    player.pos.addScaledVector(wish, FLY_SPEED * speedMul * dt);
  } else {
    player.vel.x = wish.x * walkSpeed + player.knock.x;
    player.vel.z = wish.z * walkSpeed + player.knock.z;
    player.knock.x *= Math.pow(decay, dt);
    player.knock.z *= Math.pow(decay, dt);

    if (effectActive('levitate')) {
      player.vel.y = isKeyDown('Space') ? 4 : isKeyDown('ShiftLeft') ? -4 : 0;
    } else {
      player.vel.y -= GRAVITY * dt;
      if (isKeyDown('Space') && player.onGround && speedMul > 0) player.vel.y = jumpPower;
    }
    player.onGround = false;
    moveAxis(dt, 'y');
    moveAxis(dt, 'x');
    moveAxis(dt, 'z');
  }

  if (effectActive('weightless')) {
    if (!player.flying && !player.onGround && player.vel.y < 0) player.vel.y *= 0.98;
    if (isKeyDown('Space') && !player.onGround && !player.doubleJumpUsed) {
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
  // Устаревшая функция, используйте raycastEntities
  return raycastEntities(maxDist);
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
if (isMobile) {
  for (let i = 0; i < hudSlots.length; i++) {
    const slotEl = hudSlots[i];
    slotEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      selectedSlot = i;
      refreshUI();
    });
    slotEl.addEventListener('click', (e) => {
      selectedSlot = i;
      refreshUI();
    });
  }
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

if (isMobile) {
  for (let i = 0; i < invSlots.length; i++) {
    invSlots[i].addEventListener('touchstart', (e) => {
      e.preventDefault();
      clickSlot(i, 0);
    });
  }
  if (recycleSlotDiv) {
    recycleSlotDiv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      clickSlot(36, 0);
    });
  }
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

const ALL_BLOCK_TYPES = [
  GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, SAND, GRAVEL, COAL_ORE, IRON_ORE,
  ICE, SNOW_BLOCK, CACTUS, BRICK, OBSIDIAN, GLOWSTONE, MOSSY_STONE, SANDSTONE,
  NETHERRACK, END_STONE, PURPUR, PRISMARINE, SEA_LANTERN, MAGMA, SOUL_SAND,
  HONEY, SLIME, BAMBOO, CHERRY_LOG, CHERRY_LEAVES, MUSHROOM_STEM,
  RED_MUSHROOM, BROWN_MUSHROOM, CORAL, SPONGE, MYCELIUM, TERRACOTTA, PACKED_ICE
];

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
    if (!settingsOpen && !isMobile) renderer.domElement.requestPointerLock();
  }
  refreshUI();
}
invEl.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('mousedown', (e) => {
  if (!world || document.pointerLockElement !== renderer.domElement) return;
  if (isMobile) return;

  if (combatMode) {
    if (e.button === 0) {
      if (spellQueue.length) castSpell('left');
      else {
        const target = raycastEntities(4.5);
        if (target) {
          if (target.type === 'player') net.send('attack', { target: target.id });
          else if (target.type === 'entity') net.send('attackEntity', { entityId: target.id });
        }
      }
    } else if (e.button === 2) {
      if (spellQueue.length) castSpell('right');
    }
    return;
  }

  const hit = raycastBlock(5);
  if (e.button === 0) {
    const target = raycastEntities(4.5);
    if (target && (!hit || target.dist < hit.dist)) {
      if (target.type === 'player') {
        net.send('attack', { target: target.id });
      } else if (target.type === 'entity') {
        net.send('attackEntity', { entityId: target.id });
      }
      return;
    }
    if (!hit) return;
    const [x, y, z] = hit.block;
    addItem(world.getBlock(x, y, z));
    const dirty1 = world.setBlock(x, y, z, AIR);
    dirty1.forEach(c => c.dirty = true);
    dirty1.forEach(remeshChunk);
    net.send('setBlock', { x, y, z, t: AIR });
  } else if (e.button === 2 && hit?.prev) {
    const slot = inventory[selectedSlot];
    if (!slot) return;
    const [x, y, z] = hit.prev;
    if (intersectsPlayer(x, y, z)) return;
    const dirty2 = world.setBlock(x, y, z, slot.type);
    dirty2.forEach(c => c.dirty = true);
    dirty2.forEach(remeshChunk);
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

    // Обновление сущностей (интерполяция)
    updateRemoteEntities(dt);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(animate);