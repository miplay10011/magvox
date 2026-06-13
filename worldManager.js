import { World, buildChunkMesh, buildLODMesh, CHUNK_SIZE } from './world.js';
import { scene } from './render.js';
import { player } from './player.js';

export let worldRef = null;
export const lodMeshes = new Map();

const FULL_RADIUS = 9;
const LOD_RINGS = [
  { level: 2, radius: 20 },
  { level: 3, radius: 48 },
];
const FULL_BUDGET = 8;
const LOD_BUDGET = 6;

export function remeshChunk(chunk) {
  if (chunk.mesh) { scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
  chunk.mesh = buildChunkMesh(worldRef, chunk);
  scene.add(chunk.mesh);
}

export function chunkManagerTick() {
  if (!worldRef) return;
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
  const pcz = Math.floor(player.pos.z / CHUNK_SIZE);

  const wantFull = new Set(), missing = [];
  for (let dx = -FULL_RADIUS; dx <= FULL_RADIUS; dx++)
    for (let dz = -FULL_RADIUS; dz <= FULL_RADIUS; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      wantFull.add(worldRef.key(cx, cz));
      if (!worldRef.getChunk(cx, cz)) missing.push([cx, cz, dx*dx + dz*dz]);
    }
  missing.sort((a,b)=>a[2]-b[2]);
  for (const [cx, cz] of missing.slice(0, FULL_BUDGET)) {
    remeshChunk(worldRef.generateChunk(cx, cz));
    for (const [nx, nz] of [[cx+1,cz],[cx-1,cz],[cx,cz+1],[cx,cz-1]]) {
      const nb = worldRef.getChunk(nx, nz);
      if (nb?.mesh) remeshChunk(nb);
    }
  }
  for (const [key, c] of worldRef.chunks) {
    if (!wantFull.has(key)) {
      if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
      worldRef.chunks.delete(key);
    }
  }

  const wantLod = new Set(), lodMissing = [];
  let inner = FULL_RADIUS;
  for (const { level, radius } of LOD_RINGS) {
    const s = 1 << level;
    for (let gx = Math.floor((pcx - radius) / s); gx <= Math.floor((pcx + radius) / s); gx++)
      for (let gz = Math.floor((pcz - radius) / s); gz <= Math.floor((pcz + radius) / s); gz++) {
        const d = Math.max(Math.abs(gx * s + s/2 - pcx), Math.abs(gz * s + s/2 - pcz));
        if (d > radius || d <= inner) continue;
        const key = `${level}:${gx},${gz}`;
        wantLod.add(key);
        if (!lodMeshes.has(key)) lodMissing.push([key, gx, gz, level, d]);
      }
    inner = radius;
  }
  lodMissing.sort((a,b)=>a[4]-b[4]);
  for (const [key, gx, gz, level] of lodMissing.slice(0, LOD_BUDGET)) {
    const mesh = buildLODMesh(worldRef, gx, gz, level);
    lodMeshes.set(key, mesh);
    scene.add(mesh);
  }
  for (const [key, mesh] of lodMeshes) {
    if (!wantLod.has(key)) {
      scene.remove(mesh); mesh.geometry.dispose(); lodMeshes.delete(key);
    }
  }
}

export function startWorld(seed, edits = []) {
  worldRef = new World(seed);
  for (const [key, t] of edits) worldRef.edits.set(key, t);
  player.pos.set(0.5, worldRef.terrainHeight(0,0) + 1, 0.5);
  player.vel.set(0,0,0);
  chunkManagerTick();
}