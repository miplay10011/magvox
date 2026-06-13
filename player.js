import * as THREE from 'three';
import { camera } from './render.js';
import { effectActive, spawnParticles } from './effects.js';

export const PLAYER = { width: 0.6, height: 1.8, eye: 1.62 };
export const GRAVITY = 28, JUMP_SPEED = 9, WALK_SPEED = 5, FLY_SPEED = 12;

export let player = {
  pos: new THREE.Vector3(0.5, 80, 0.5),
  vel: new THREE.Vector3(),
  knock: new THREE.Vector3(),
  onGround: false,
  flying: false,
  doubleJumpUsed: false,
};

export let yaw = 0, pitch = 0;
export let keys = new Set();
export let worldRef = null;

export function setWorldRef(w) { worldRef = w; }

function moveAxis(dt, axis) {
  const half = PLAYER.width / 2, E = 1e-4;
  const min = { x: player.pos.x - half, y: player.pos.y,                 z: player.pos.z - half };
  const max = { x: player.pos.x + half, y: player.pos.y + PLAYER.height, z: player.pos.z + half };
  let newPos = player.pos[axis] + player.vel[axis] * dt;
  const step = 0.05;
  for (let t = 0; t <= dt; t += step) {
    const testPos = player.pos[axis] + player.vel[axis] * t;
    const testMin = { ...min, [axis]: testPos - half };
    const testMax = { ...max, [axis]: testPos + half };
    let collision = false;
    for (let y = Math.floor(testMin.y); y <= Math.ceil(testMax.y - E); y++) {
      for (let x = Math.floor(testMin.x); x <= Math.ceil(testMax.x - E); x++) {
        for (let z = Math.floor(testMin.z); z <= Math.ceil(testMax.z - E); z++) {
          if (worldRef.getBlock(x, y, z) !== 0) {
            collision = true;
            break;
          }
        }
      }
    }
    if (!collision) {
      player.pos[axis] = testPos;
    } else {
      player.vel[axis] = 0;
      break;
    }
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
        if (worldRef.getBlock(x, y, z) !== 0) { stuck = true; break; }
      }
    }
  }
  if (!stuck) return;
  const radius = 5;
  let bestDist = Infinity, bestPos = null;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const nx = Math.floor(player.pos.x + dx);
      const nz = Math.floor(player.pos.z + dz);
      const groundY = worldRef.terrainHeight(nx, nz);
      if (worldRef.getBlock(nx, groundY + 1, nz) === 0 &&
          worldRef.getBlock(nx, groundY + 2, nz) === 0 &&
          worldRef.getBlock(nx, groundY, nz) !== 0) {
        const dist = dx*dx + dz*dz;
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

export function updatePlayer(dt) {
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
    player.pos.set(0.5, worldRef.terrainHeight(0, 0) + 1, 0.5);
    player.vel.set(0, 0, 0);
    player.knock.set(0, 0, 0);
  }
  resolveBlockStuck();
  camera.position.set(player.pos.x, player.pos.y + PLAYER.eye, player.pos.z);
}