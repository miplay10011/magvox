import * as THREE from 'three';
import { scene } from './render.js';

export const MAX_P = 3000;
export const pGeo = new THREE.BufferGeometry();
export const pPosArr = new Float32Array(MAX_P * 3), pColArr = new Float32Array(MAX_P * 3);
pGeo.setAttribute('position', new THREE.BufferAttribute(pPosArr, 3));
pGeo.setAttribute('color', new THREE.BufferAttribute(pColArr, 3));
export const pPoints = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.18, vertexColors: true, transparent: true, opacity: 0.9,
}));
pPoints.frustumCulled = false;
scene.add(pPoints);
export const particles = [];

export function spawnParticles(x, y, z, color, count, spread, life = 0.8) {
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

export function updateParticles(dt) {
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

export let activeEffects = new Map();

export function setActiveEffects(map) {
  activeEffects = map;
}

export function effectActive(name) {
  const e = activeEffects.get(name);
  return e && e.until > Date.now() ? e : null;
}