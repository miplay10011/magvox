import { initRender, renderer, scene, camera } from './render.js';
import { initNetwork, net, myId, myNickname, setMyId, setMyNickname } from './network.js';
import { initInventory, toggleInventory, addItem, refreshUI, selectedSlot, inventory, held, clickSlot, invOpen } from './inventory.js';
import { initUI, addChatMessage, updateCoordDisplay, toggleSettings, settingsOpen, chatFocused, SENS, setStatus } from './ui.js';
import { spawnParticles, updateParticles, activeEffects, setActiveEffects, effectActive as effectActiveCore } from './effects.js';
import { initRemotePlayers, addRemotePlayer, removeRemotePlayer, updateRemotePlayers, remotePlayers, flashPlayerModel } from './remotePlayers.js';
import { player, yaw, pitch, keys, updatePlayer, setWorldRef as setPlayerWorld, PLAYER } from './player.js';
import { initMagicUI, flashIcon, addElement, combatMode, spellQueue, refreshQueueUI, castSpellLocal } from './magicUI.js';
import { createMagicEngine } from './magic.js';
import { World, AIR, BLOCK_COLORS } from './world.js';
import { startWorld, worldRef, remeshChunk, chunkManagerTick } from './worldManager.js';
import { 
  PROJ_COLORS, projGeo, projectiles, mineMeshes, transients, 
  spawnTransient, updateTransients, projSpawnHandler, projEndHandler, explosionHandler, beamHandler
} from './projectiles.js';

// ========== Глобальные переменные ==========
let stats = { hp: 20, armor: 0, mana: 20, maxMana: 20 };
let burnAcc = 0;
let lastTime = performance.now();
let cameraLocked = false;
let shieldMesh = null;
let blindnessOverlay = null;
let localMagic = null;

function effectActive(name) { return effectActiveCore(name); }

function setBlindness(active) {
  if (!blindnessOverlay) {
    blindnessOverlay = document.createElement('div');
    blindnessOverlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(255,255,200,0.7); pointer-events:none; z-index:1000; display:none;';
    document.body.appendChild(blindnessOverlay);
  }
  blindnessOverlay.style.display = active ? 'block' : 'none';
}

function damageFlash() {
  const flashEl = document.getElementById('damage-flash');
  flashEl.style.transition = 'none';
  flashEl.style.opacity = 1;
  requestAnimationFrame(() => {
    flashEl.style.transition = 'opacity 0.4s';
    flashEl.style.opacity = 0;
  });
}

function renderStats() {
  const heartsEl = document.getElementById('hearts');
  const manaFill = document.getElementById('mana-fill');
  let s = '';
  for (let i = 0; i < 10; i++)
    s += `<span style="color:${stats.hp >= (i+1)*2-1 ? '#e33' : '#444'}">\u2665</span>`;
  s += '  ';
  for (let i = 0; i < 5; i++)
    s += `<span style="color:${stats.armor >= (i+1)*4 ? '#ccc' : '#444'}">\u26E8</span>`;
  heartsEl.innerHTML = s;
  manaFill.style.width = (Math.max(0, stats.mana) / stats.maxMana * 100) + '%';
}

function renderEffects() {
  const effectsEl = document.getElementById('effects-hud');
  const now = Date.now();
  let html = '';
  for (const [e, v] of activeEffects) {
    if (v.until < now) continue;
    html += `${e} ${Math.ceil((v.until - now)/1000)}с<br>`;
  }
  effectsEl.innerHTML = html;
}

function setActiveEffectsWithVisuals(map) {
  setActiveEffects(map);
  setBlindness(map.has('blind'));
  if (map.has('ward')) {
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
  if (map.has('shadow_shackles')) {
    cameraLocked = true;
    setTimeout(() => { cameraLocked = false; }, 6000);
  }
  if (map.has('disorient')) {
    document.body.style.transform = 'rotate(180deg)';
    setTimeout(() => document.body.style.transform = '', 6000);
  }
  if (map.has('fear')) {
    document.body.style.filter = 'blur(4px)';
    setTimeout(() => document.body.style.filter = '', 5000);
  }
}

function suicide() {
  stats.hp = 0;
  renderStats();
  damageFlash();
  stats.hp = 20;
  activeEffects.clear();
  setActiveEffectsWithVisuals(new Map());
  renderStats();
  let attempts = 0, foundSpot = false, spawnX = 0, spawnZ = 0, spawnY = 0;
  while (!foundSpot && attempts < 20) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 100;
    spawnX = Math.cos(angle) * radius;
    spawnZ = Math.sin(angle) * radius;
    const terrainY = worldRef.terrainHeight(spawnX, spawnZ);
    const checkX = Math.floor(spawnX);
    const checkZ = Math.floor(spawnZ);
    let safe = true;
    for (let y = terrainY; y < terrainY + 2; y++) {
      if (worldRef.getBlock(checkX, y, checkZ) !== 0) { safe = false; break; }
    }
    const groundBlock = worldRef.getBlock(checkX, terrainY - 1, checkZ);
    if (safe && groundBlock !== 0 && terrainY > 0) { spawnY = terrainY; foundSpot = true; }
    attempts++;
  }
  if (!foundSpot) {
    spawnX = 0; spawnZ = 0;
    spawnY = worldRef.terrainHeight(0, 0);
  }
  player.pos.set(spawnX + 0.5, spawnY, spawnZ + 0.5);
  player.vel.set(0, 0, 0);
  player.knock.set(0, 0, 0);
  addChatMessage('Система', 'Вы совершили самоубийство');
}

function toggleFly() {
  player.flying = !player.flying;
  player.vel.set(0, 0, 0);
  addChatMessage('Система', player.flying ? 'Режим полёта включён' : 'Режим полёта выключен');
}

function castSpell() {
  if (!spellQueue.length) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  if (net.connected) {
    net.send('cast', { elements: [...spellQueue], dir: [dir.x, dir.y, dir.z] });
  } else {
    if (!localMagic) localMagic = createMagicEngine({
      getBlock: (x,y,z) => worldRef.getBlock(x,y,z),
      setBlock: (x,y,z,t) => worldRef.setBlock(x,y,z,t).forEach(remeshChunk),
      terrainHeight: (x,z) => worldRef.terrainHeight(x,z),
      getPlayers: () => [['me', { x: player.pos.x, y: player.pos.y, z: player.pos.z }]],
      applyDamage: (id, dmg, src) => {
        stats.hp -= dmg; renderStats(); damageFlash();
        if (src.kb > 0) {
          const d = new THREE.Vector3(player.pos.x - src.ax, 0, player.pos.z - src.az).normalize();
          player.knock.addScaledVector(d, src.kb);
          player.vel.y += 4;
        }
        if (stats.hp <= 0) suicide();
      },
      addEffect: (id, type, dur, power) => {
        const map = new Map(activeEffects);
        map.set(type, { until: Date.now() + dur*1000, power: power?.power ?? power });
        setActiveEffectsWithVisuals(map);
      },
      healPlayer: (id, a) => { stats.hp = Math.min(20, stats.hp + a); renderStats(); },
      clearDebuffs: () => {
        for (const b of ['burning','slow','freeze','curse','blind','weakness','vulnerability','disorient','disarm','shadow_shackles']) activeEffects.delete(b);
        setActiveEffectsWithVisuals(new Map(activeEffects));
      },
      getMana: () => stats.mana,
      spendMana: (id, c) => { stats.mana -= c; renderStats(); },
      teleportPlayer: (id, x, y, z) => { player.pos.set(x, y, z); player.vel.set(0,0,0); },
      emit: () => {}
    });
    localMagic.cast('me', [...spellQueue], [dir.x, dir.y, dir.z],
      { x: camera.position.x, y: camera.position.y, z: camera.position.z }, yaw);
  }
  spellQueue.length = 0;
  refreshQueueUI();
}

// Троттлинг позиции
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

// ========== EVENTS (сетевые обработчики) ==========
const EVENTS = {
  blockUpdate: (m) => { if (worldRef) worldRef.setBlock(m.x, m.y, m.z, m.t).forEach(remeshChunk); },
  projSpawn: projSpawnHandler,
  projEnd: projEndHandler,
  explosion: explosionHandler,
  beam: beamHandler,
  nova: (m) => {
    const ring = new THREE.Mesh(new THREE.SphereGeometry(0.6,14,10),
      new THREE.MeshBasicMaterial({ color: 0xbfe8ff, wireframe: true, transparent: true }));
    ring.position.set(m.x, m.y+1, m.z);
    spawnTransient(ring, 0.4, 18);
  },
  mineSpawn: (m) => {
    const mine = new THREE.Mesh(new THREE.SphereGeometry(0.3,8,6),
      new THREE.MeshLambertMaterial({ color: 0x3a2050, emissive: 0x603a80 }));
    mine.position.set(m.x, m.y+0.3, m.z);
    scene.add(mine);
    mineMeshes.set(m.id, mine);
  },
  mineEnd: (m) => {
    const mesh = mineMeshes.get(m.id);
    if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); mineMeshes.delete(m.id); }
  },
  teleport: (m) => {
    if (m.id === myId || m.id === 'me') { player.pos.set(m.x, m.y, m.z); player.vel.set(0,0,0); }
    else { const rp = remotePlayers.get(m.id); if(rp) rp.target.set(m.x, m.y, m.z); }
  },
  teleportFx: (m) => { spawnParticles(m.x0,m.y0,m.z0,0x9050c0,20,3,0.7); spawnParticles(m.x1,m.y1,m.z1,0x9050c0,20,3,0.7); },
  lightningEffect: (m) => {
    const from = remotePlayers.get(m.from)?.group.position || player.pos;
    const to = remotePlayers.get(m.to)?.group.position || player.pos;
    const points = [from.clone(), to.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffaa44, linewidth: 2 }));
    scene.add(line);
    setTimeout(() => scene.remove(line), 200);
    spawnParticles(to.x, to.y+1, to.z, 0xffaa44, 15,2,0.5);
  },
  zoneSpawn: (m) => {
    const ringGeo = new THREE.RingGeometry(m.radius-0.2, m.radius+0.2, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x88ffaa, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI/2;
    ring.position.set(m.x, 0.1, m.z);
    scene.add(ring);
    const interval = setInterval(() => {
      if (!ring.parent) { clearInterval(interval); return; }
      spawnParticles(m.x + (Math.random()-0.5)*m.radius, 0.5, m.z + (Math.random()-0.5)*m.radius, 0xaaffaa, 3,0.5,0.3);
    }, 500);
    setTimeout(() => { scene.remove(ring); clearInterval(interval); }, (m.duration||8)*1000);
  },
  zoneEnd: () => {},
  chainLink: (m) => {
    const p1 = remotePlayers.get(m.id1)?.group, p2 = remotePlayers.get(m.id2)?.group;
    if(p1 && p2) {
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
    if(p1 && p2) {
      spawnParticles(p1.position.x, p1.position.y+1, p1.position.z, 0x33aaff, 30,3,0.8);
      spawnParticles(p2.position.x, p2.position.y+1, p2.position.z, 0x33aaff, 30,3,0.8);
    }
  },
  shadowStepFx: (m) => { spawnParticles(m.x0,1,m.z0,0x9900ff,40,4,0.7); spawnParticles(m.x1,1,m.z1,0x9900ff,40,4,0.7); },
  dragonBreathCone: (m) => {
    for(let i=0;i<60;i++) {
      const angle = m.yaw + (Math.random()-0.5)*Math.PI/1.5;
      const dist = Math.random()*8;
      const x = m.origin.x + Math.sin(angle)*dist;
      const z = m.origin.z + Math.cos(angle)*dist;
      spawnParticles(x,1.5,z,0xffaa66,3,0.8,0.4);
    }
  },
  dragonBreathFx: (m) => { spawnParticles(m.to.x, m.to.y+1, m.to.z, 0xff6644,20,2,0.6); },
  totemSpawn: (m) => {
    const geo = new THREE.BoxGeometry(0.8,1.2,0.8);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0x442200 });
    const totem = new THREE.Mesh(geo, mat);
    totem.position.set(m.x,0.6,m.z);
    scene.add(totem);
    setTimeout(() => scene.remove(totem), (m.duration||30)*1000);
  },
  totemCharge: (m) => {
    const target = remotePlayers.get(m.targetId);
    if(target) spawnParticles(target.group.position.x, target.group.position.y+1, target.group.position.z, 0xffaa44,20,1.5,0.5);
  },
  totemPower: (m) => {
    const target = remotePlayers.get(m.targetId);
    if(target) spawnParticles(target.group.position.x, target.group.position.y+1, target.group.position.z, 0xffdd88,15,1,0.3);
  },
  totemEnd: () => {},
  sphereSpawn: (m) => {
    const sphereGeo = new THREE.SphereGeometry(3,32,32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.3, wireframe: true });
    const sphere = new THREE.Mesh(sphereGeo, mat);
    sphere.position.set(m.x, m.y+1.5, m.z);
    scene.add(sphere);
    setTimeout(() => scene.remove(sphere), (m.duration||8)*1000);
  },
  sphereEnd: () => {},
  asteroidStart: (m) => {
    const geo = new THREE.SphereGeometry(1.5,16,16);
    const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x441111 });
    const asteroid = new THREE.Mesh(geo, mat);
    asteroid.position.set(m.x, m.startY, m.z);
    scene.add(asteroid);
    let fall = setInterval(() => {
      asteroid.position.y -= 2;
      if(asteroid.position.y < 1) { clearInterval(fall); scene.remove(asteroid); }
    }, 50);
    setTimeout(() => scene.remove(asteroid), 1500);
  },
  asteroidImpact: (m) => {
    spawnParticles(m.x,2,m.z,0x884422,100,6,1.2);
    for(let i=0;i<50;i++) {
      const dx = (Math.random()-0.5)*m.radius*2;
      const dz = (Math.random()-0.5)*m.radius*2;
      spawnParticles(m.x+dx,1,m.z+dz,0x664422,5,1,0.8);
    }
  },
  stompFx: (m) => {
    const ringGeo = new THREE.RingGeometry(0.5, m.radius, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffaa44, side: THREE.DoubleSide, transparent: true });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI/2;
    ring.position.set(m.x, 0.1, m.z);
    scene.add(ring);
    setTimeout(() => scene.remove(ring), 500);
    spawnParticles(m.x,0.5,m.z,0xffaa44,40,3,0.6);
  },
  vortexSpawn: (m) => {
    const points = [];
    for(let i=0;i<=20;i++) {
      const angle = i*Math.PI*2/20;
      const x = m.x + Math.cos(angle)*4;
      const z = m.z + Math.sin(angle)*4;
      points.push(new THREE.Vector3(x,0.2,z));
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x660066 });
    const circle = new THREE.LineLoop(lineGeo, lineMat);
    scene.add(circle);
    setTimeout(() => scene.remove(circle), (m.duration||8)*1000);
  },
  vortexEnd: () => {},
  cageSpawn: (m) => {
    const target = remotePlayers.get(m.targetId);
    if(target) {
      const box = new THREE.BoxHelper(target.group, 0xff44ff);
      scene.add(box);
      setTimeout(() => scene.remove(box), 6000);
    }
  },
  cageEnd: () => {},
  shacklesFx: (m) => {
    const target = remotePlayers.get(m.targetId);
    if(target) spawnParticles(target.group.position.x, target.group.position.y+1, target.group.position.z, 0x000000,30,2,1);
  },
  timeSlowZone: (m) => {
    const ringGeo = new THREE.RingGeometry(m.radius-0.2, m.radius+0.2, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x88aaff, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const ring = new THREE.Mesh(ringGeo, mat);
    ring.rotation.x = -Math.PI/2;
    ring.position.set(m.x, 0.1, m.z);
    scene.add(ring);
    setTimeout(() => scene.remove(ring), (m.duration||15)*1000);
  },
};
for (const [t, f] of Object.entries(EVENTS)) net.on(t, f);

// ========== Сетевые обработчики ==========
net.on('init', (m) => {
  setMyId(m.id);
  setMyNickname(m.nickname);
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
net.on('join', (m) => addRemotePlayer(m.id, { x: 0.5, y: 80, z: 0.5, yaw: 0, nickname: m.nickname }));
net.on('leave', (m) => removeRemotePlayer(m.id));
net.on('move', (m) => {
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
  const newEffects = new Map();
  for (const it of m.list) newEffects.set(it.e, { until: it.until, power: it.power });
  setActiveEffectsWithVisuals(newEffects);
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
  stats.hp = 20; renderStats();
  activeEffects.clear();
  setActiveEffectsWithVisuals(new Map());
  player.pos.set(0.5, worldRef.terrainHeight(0,0)+1, 0.5);
  player.vel.set(0,0,0);
  player.knock.set(0,0,0);
});
net.on('disconnect', () => {
  if (!worldRef) startWorld(Math.random() * 10000, []);
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id);
  setStatus('оффлайн (одиночная игра)');
});
net.on('systemMessage', (msg) => addChatMessage('Система', msg.message));
net.on('chat', (msg) => {
  const senderName = msg.senderId === myId ? 'You' : (msg.senderNick || `Player ${msg.senderId}`);
  addChatMessage(senderName, msg.message);
});

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
    if (worldRef.getBlock(bx, by, bz) !== 0) return { block: [bx, by, bz], prev, dist: t };
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
    if (hits.length && (!best || hits[0].distance < best.dist)) best = { id, dist: hits[0].distance };
  }
  return best;
}
function intersectsPlayer(bx, by, bz) {
  const half = PLAYER.width / 2;
  return bx + 1 > player.pos.x - half && bx < player.pos.x + half &&
         by + 1 > player.pos.y        && by < player.pos.y + PLAYER.height &&
         bz + 1 > player.pos.z - half && bz < player.pos.z + half;
}

// ========== Обработчики ввода ==========
document.addEventListener('mousedown', (e) => {
  if (!worldRef || document.pointerLockElement !== renderer.domElement) return;
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
    addItem(worldRef.getBlock(x, y, z));
    worldRef.setBlock(x, y, z, 0).forEach(remeshChunk);
    net.send('setBlock', { x, y, z, t: 0 });
  } else if (e.button === 2 && hit?.prev) {
    const slot = inventory[selectedSlot];
    if (!slot) return;
    const [x, y, z] = hit.prev;
    if (intersectsPlayer(x, y, z)) return;
    worldRef.setBlock(x, y, z, slot.type).forEach(remeshChunk);
    net.send('setBlock', { x, y, z, t: slot.type });
    if (--slot.count <= 0) inventory[selectedSlot] = null;
    refreshUI();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Tab') { e.preventDefault(); toggleSettings(!settingsOpen); return; }
  if (e.code === 'Escape' && settingsOpen) { e.preventDefault(); toggleSettings(false); return; }
  if (settingsOpen) return;
  if (chatFocused) return;
  if (e.code === 'KeyT') { document.getElementById('chat-input').focus(); return; }
  if (e.code === 'Slash') { const input = document.getElementById('chat-input'); input.focus(); input.value = '/'; return; }
  if (e.code === 'KeyE') { toggleInventory(); return; }
  if (invOpen) return;
  if (e.code === 'KeyQ') {
    combatMode = !combatMode;
    spellQueue.length = 0;
    refreshQueueUI();
    document.getElementById('magic-ring').classList.toggle('combat', combatMode);
    return;
  }
  if (e.code === 'KeyX' && combatMode) { spellQueue.length = 0; refreshQueueUI(); return; }
  keys.add(e.code);
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n>=1 && n<=9) {
      if (combatMode) addElement(n-1);
      else { selectedSlot = n-1; refreshUI(); }
    }
  }
});
document.addEventListener('keyup', (e) => keys.delete(e.code));
document.addEventListener('wheel', (e) => {
  if (invOpen || combatMode) return;
  selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
  refreshUI();
});
renderer.domElement.addEventListener('click', () => { if (!invOpen) renderer.domElement.requestPointerLock(); });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement) return;
  if (settingsOpen) return;
  if (cameraLocked) return;
  yaw -= e.movementX * SENS;
  pitch -= e.movementY * SENS;
  pitch = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, pitch));
});

// ========== Игровой цикл ==========
let lastFrameTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
  lastFrameTime = now;
  if (worldRef) {
    if (!chatFocused && !settingsOpen) updatePlayer(dt);
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
      const burn = activeEffects.get('burning');
      if (burn) {
        burnAcc += dt;
        if (burnAcc >= 1) { burnAcc -= 1; stats.hp -= burn.power; renderStats(); damageFlash(); }
      }
      renderStats();
    }
    updateTransients(dt);
    updateParticles(dt);
    syncPosition(now);
    renderEffects();
    updateCoordDisplay();
  }
  renderer.render(scene, camera);
}

// Инициализация
function init() {
  initRender();
  initUI();
  initInventory();
  initRemotePlayers();
  initMagicUI();
  initNetwork();
  setPlayerWorld(worldRef);
  // startWorld будет вызван из net.on('init') при подключении
  // для офлайн-режима запустим мир, только если нет соединения
  if (!net.connected) startWorld(Math.random() * 10000, []);
  requestAnimationFrame(animate);
  window.suicide = suicide;
  window.toggleFly = toggleFly;
}

init();