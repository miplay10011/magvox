// inventory.js
import { BLOCK_COLORS, GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, SAND, GRAVEL, COAL_ORE, IRON_ORE } from './world.js';
import { spawnParticles } from './particles.js';

// Эти переменные будут установлены из main.js через setGlobals
let globalPlayer = null;
let globalRenderer = null;
let globalKeys = null;
let globalSettingsOpen = null;
let globalAddChatMessage = null;

export function setGlobals(player, renderer, keys, settingsOpen, addChatMessage) {
  globalPlayer = player;
  globalRenderer = renderer;
  globalKeys = keys;
  globalSettingsOpen = settingsOpen;
  globalAddChatMessage = addChatMessage;
}

export const INV_SIZE = 37;
export let inventory = new Array(INV_SIZE).fill(null);
export let selectedSlot = 0;
export let held = null;
export let invOpen = false;

const ALL_BLOCK_TYPES = [GRASS, DIRT, STONE, WOOD, LEAVES, PLANKS, SAND, GRAVEL, COAL_ORE, IRON_ORE];

let hotbarEl = null;
let hudSlots = [];
let invSlots = [];
let recycleSlotDiv = null;
let recycleBtn = null;

export function renderSlot(el, slot) {
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

export function refreshUI() {
  if (!hudSlots.length) return;
  for (let i = 0; i < 9; i++) {
    renderSlot(hudSlots[i], inventory[i]);
    hudSlots[i].classList.toggle('selected', i === selectedSlot);
  }
  for (let i = 9; i < 36; i++) {
    if (invSlots[i]) renderSlot(invSlots[i], inventory[i]);
  }
  if (recycleSlotDiv) renderSlot(recycleSlotDiv, inventory[36]);
  const heldEl = document.getElementById('held-item');
  if (heldEl) {
    heldEl.style.display = held ? 'block' : 'none';
    if (held) {
      heldEl.style.background = '#' + BLOCK_COLORS[held.type].getHexString();
      const cntSpan = heldEl.querySelector('.count');
      if (cntSpan) cntSpan.textContent = held.count;
    }
  }
}

export function clickSlot(i, button) {
  const slot = inventory[i];
  if (button === 0) {
    if (!held && slot) {
      held = slot;
      inventory[i] = null;
    } else if (held && !slot) {
      inventory[i] = held;
      held = null;
    } else if (held && slot && slot.type === held.type) {
      const move = Math.min(64 - slot.count, held.count);
      slot.count += move;
      held.count -= move;
      if (held.count <= 0) held = null;
    } else if (held && slot) {
      inventory[i] = held;
      held = slot;
    }
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

export function addItem(type) {
  let slot = inventory.find(s => s && s.type === type && s.count < 64);
  if (slot) {
    slot.count++;
    refreshUI();
    return;
  }
  const i = inventory.findIndex(s => s === null);
  if (i !== -1) {
    inventory[i] = { type, count: 1 };
    refreshUI();
  }
}

export function recycleItem() {
  const slot = inventory[36];
  if (!slot) {
    if (globalAddChatMessage) globalAddChatMessage('Система', 'Положите блок в синий слот, чтобы переработать');
    return;
  }
  const newType = ALL_BLOCK_TYPES[Math.floor(Math.random() * ALL_BLOCK_TYPES.length)];
  slot.type = newType;
  slot.count = 1;
  refreshUI();
  if (globalPlayer) {
    spawnParticles(globalPlayer.pos.x, globalPlayer.pos.y + 1, globalPlayer.pos.z, BLOCK_COLORS[newType].getHex(), 30, 2.5, 1.2);
  }
  if (globalAddChatMessage) globalAddChatMessage('Система', `Предмет превращён в ${Object.keys(BLOCK_COLORS)[newType] || 'блок'}!`);
}

export function toggleInventory() {
  invOpen = !invOpen;
  const invEl = document.getElementById('inventory');
  if (invEl) invEl.classList.toggle('open', invOpen);
  if (invOpen) {
    document.exitPointerLock();
    if (globalKeys) globalKeys.clear();
  } else {
    if (held) {
      for (let n = held.count; n > 0; n--) addItem(held.type);
      held = null;
    }
    if (!globalSettingsOpen && globalRenderer) globalRenderer.domElement.requestPointerLock();
  }
  refreshUI();
}

export function initInventory() {
  hotbarEl = document.getElementById('hotbar');
  if (!hotbarEl) return;
  for (let i = 0; i < 9; i++) {
    const el = document.createElement('div');
    el.className = 'slot';
    hotbarEl.appendChild(el);
    hudSlots.push(el);
  }
  const invEl = document.getElementById('inventory');
  invSlots = new Array(INV_SIZE);
  function makeInvSlot(index, container) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.addEventListener('mousedown', (e) => { e.preventDefault(); clickSlot(index, e.button); });
    container.appendChild(el);
    invSlots[index] = el;
  }
  const invMain = document.getElementById('inv-main');
  const invHotbarRow = document.getElementById('inv-hotbar-row');
  if (invMain && invHotbarRow) {
    for (let i = 9; i < 36; i++) makeInvSlot(i, invMain);
    for (let i = 0; i < 9; i++) makeInvSlot(i, invHotbarRow);
  }
  recycleSlotDiv = document.getElementById('recycle-slot');
  if (recycleSlotDiv) {
    recycleSlotDiv.addEventListener('mousedown', (e) => {
      e.preventDefault();
      clickSlot(36, e.button);
    });
  }
  recycleBtn = document.getElementById('recycle-button');
  if (recycleBtn) {
    recycleBtn.addEventListener('click', () => recycleItem());
  }
  if (invEl) invEl.addEventListener('contextmenu', (e) => e.preventDefault());
  refreshUI();
}