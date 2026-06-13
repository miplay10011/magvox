import { renderer, camera } from './render.js';
import { player, yaw, pitch, keys, setWorldRef } from './player.js';
import { net } from './network.js';
import { invOpen, toggleInventory } from './inventory.js';
import { combatMode, spellQueue, refreshQueueUI, addElement } from './magicUI.js';

export let chatFocused = false;
export let chatInput = null;
export let chatMessages = null;
export let coordDisplay = null;
export let settingsOpen = false;
export let settingsMenu = null;
export let SENS = 0.002;

export let setStatus = (s) => { const el = document.getElementById('status'); if (el) el.textContent = s; };

export function addChatMessage(sender, message) {
  const msgDiv = document.createElement('div');
  msgDiv.textContent = `${sender}: ${message}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

export function updateCoordDisplay() {
  if (coordDisplay) {
    coordDisplay.textContent = `X: ${player.pos.x.toFixed(2)} Y: ${player.pos.y.toFixed(2)} Z: ${player.pos.z.toFixed(2)}`;
  }
}

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
  const currentSens = SENS;
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
    SENS = val / 1000;
    localStorage.setItem('voxel_sensitivity', SENS);
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

export function toggleSettings(open) {
  settingsOpen = open;
  if (!settingsMenu) return;
  settingsMenu.style.display = open ? 'flex' : 'none';
  if (open) {
    if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
    if (chatInput) chatInput.blur();
    keys.clear();
  } else {
    if (!invOpen && document.pointerLockElement !== renderer.domElement && !chatFocused) {
      renderer.domElement.requestPointerLock();
    }
  }
}

export function initUI() {
  coordDisplay = document.getElementById('coord-display');
  chatMessages = document.getElementById('chat-messages');
  chatInput = document.getElementById('chat-input');
  
  chatInput.addEventListener('focus', () => {
    chatFocused = true;
    keys.clear();
  });
  chatInput.addEventListener('blur', () => { chatFocused = false; });
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      let message = chatInput.value.trim();
      if (message.startsWith('/')) {
        if (message === '/kill') {
          // вызов suicide будет из main
          window.suicide && window.suicide();
        } else if (message === '/fly') {
          window.toggleFly && window.toggleFly();
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
      net.send('chat', { message });
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
  
  // Восстановление чувствительности
  const saved = localStorage.getItem('voxel_sensitivity');
  if (saved) SENS = parseFloat(saved);
}