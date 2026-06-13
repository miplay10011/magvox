import { net } from './network.js';
import { camera } from './render.js';
import { yaw } from './player.js';

export let combatMode = false;
export let spellQueue = [];
const ringEl = document.getElementById('magic-ring');
const queueEl = document.getElementById('spell-queue');
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
const CONFLICTS = [['fire','water'], ['fire','ice'], ['light','dark']];
const iconEls = [];

export function initMagicUI() {
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
}

export function flashIcon(i) {
  iconEls[i].classList.add('flash');
  setTimeout(() => iconEls[i].classList.remove('flash'), 200);
}

export function refreshQueueUI() {
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

export function addElement(i) {
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

export function castSpellLocal() {
  if (spellQueue.length === 0) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  net.send('cast', { elements: [...spellQueue], dir: [dir.x, dir.y, dir.z] });
  spellQueue.length = 0;
  refreshQueueUI();
}