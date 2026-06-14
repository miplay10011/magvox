import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const AIR = 0;
export const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5;
export const PLANKS = 6, SAND = 7, GRAVEL = 8, COAL_ORE = 9, IRON_ORE = 10;

export const BLOCK_COLORS = {
  [GRASS]: new THREE.Color(0x7cb518), [DIRT]:  new THREE.Color(0x8b5a2b),
  [STONE]: new THREE.Color(0x808080), [WOOD]:  new THREE.Color(0xbc9a6c),
  [LEAVES]: new THREE.Color(0x2e7d32), [PLANKS]: new THREE.Color(0xc99e6f),
  [SAND]:  new THREE.Color(0xf4e2b9), [GRAVEL]: new THREE.Color(0x9e9e9e),
  [COAL_ORE]: new THREE.Color(0x2c2c2c), [IRON_ORE]: new THREE.Color(0xb87333),
};
export const CHUNK_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

// ---------- Binary color & normal caches ----------
const CR = new Float32Array(11);
const CG = new Float32Array(11);
const CB = new Float32Array(11);
for (let i = 1; i <= 10; i++) {
  const c = BLOCK_COLORS[i];
  CR[i] = c.r; CG[i] = c.g; CB[i] = c.b;
}

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    this.mesh = null;
    this.dirty = true;
  }
  index(x, y, z) { return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE; }
  get(x, y, z)    { return this.blocks[this.index(x, y, z)]; }
  set(x, y, z, t) { this.blocks[this.index(x, y, z)] = t; }
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.noise = new ImprovedNoise();
    this.chunks = new Map();
    this.edits = new Map();
  }
  key(cx, cz) { return `${cx},${cz}`; }
  getChunk(cx, cz) { return this.chunks.get(this.key(cx, cz)); }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return AIR;
    const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
    const c = this.getChunk(cx, cz);
    return c ? c.get(wx - cx * CHUNK_SIZE, wy, wz - cz * CHUNK_SIZE) : AIR;
  }

  terrainHeight(wx, wz) {
    const s = this.seed;
    let h = 24;
    h += this.noise.noise(wx / 80 + s, wz / 80 + s, 0)   * 16;
    h += this.noise.noise(wx / 30 + s, wz / 30 + s, 100) * 6;
    h += this.noise.noise(wx / 12 + s, wz / 12 + s, 200) * 2;
    const biome = this.getBiome(wx, wz);
    if (biome === 'desert') {
      h = 28 + this.noise.noise(wx / 50 + s, wz / 50 + s, 400) * 3;
      h = Math.max(24, Math.min(35, h));
    } else if (biome === 'mountain') {
      h += this.noise.noise(wx / 20 + s, wz / 20 + s, 150) * 20;
      h += Math.abs(this.noise.noise(wx / 6 + s, wz / 6 + s, 250)) * 12;
      h = Math.max(45, Math.min(63, h));
    } else {
      h += this.noise.noise(wx / 25 + s, wz / 25 + s, 300) * 6;
      h = Math.max(20, Math.min(50, h));
    }
    return Math.max(1, Math.min(WORLD_HEIGHT - 1, Math.floor(h)));
  }

  getBiome(wx, wz) {
    const val = this.noise.noise(wx * 0.005 + this.seed, wz * 0.005 + this.seed, 300);
    if (val < -0.25) return 'desert';
    if (val > 0.35) return 'mountain';
    return 'forest';
  }

  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;

    const heights = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomes  = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x, wz = oz + z;
        heights[x + z * CHUNK_SIZE] = this.terrainHeight(wx, wz);
        const b = this.getBiome(wx, wz);
        biomes[x + z * CHUNK_SIZE] = b === 'desert' ? 1 : (b === 'mountain' ? 2 : 0);
      }
    }

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const idx = x + z * CHUNK_SIZE;
        const height = heights[idx];
        const biome = biomes[idx];
        for (let y = 0; y < height; y++) {
          let block = STONE;
          if (y === height - 1) {
            block = biome === 1 ? SAND : GRASS;
          } else if (y >= height - 4) {
            block = DIRT;
          } else {
            if (y < 40 && this.noise.noise((ox + x) * 0.1, y * 0.1, (oz + z) * 0.1) > 0.85)
              block = IRON_ORE;
            else if (y < 60 && this.noise.noise((ox + x) * 0.12, y * 0.12, (oz + z) * 0.12) > 0.7)
              block = COAL_ORE;
          }
          chunk.set(x, y, z, block);
        }
        if (biome === 1 && height < WORLD_HEIGHT - 1 && Math.random() < 0.3) {
          chunk.set(x, height, z, SAND);
        }
      }
    }

    if (biomes[8 + 8 * CHUNK_SIZE] === 0 && Math.random() < 0.1) {
      const groundY = heights[8 + 8 * CHUNK_SIZE];
      if (groundY < 55) this.generateBigTree(chunk, 8, 8, groundY);
    }

    for (const [key, t] of this.edits) {
      const [ex, ey, ez] = key.split(',').map(Number);
      if (Math.floor(ex / CHUNK_SIZE) === cx && Math.floor(ez / CHUNK_SIZE) === cz) {
        chunk.set(ex - cx * CHUNK_SIZE, ey, ez - cz * CHUNK_SIZE, t);
      }
    }

    this.chunks.set(this.key(cx, cz), chunk);
    return chunk;
  }

  generateBigTree(chunk, cx, cz, groundY) {
    const trunkHeight = 5 + Math.floor(Math.random() * 3);
    const startX = cx, startZ = cz, startY = groundY;
    for (let h = 0; h < trunkHeight; h++) {
      const y = startY + h;
      if (y >= WORLD_HEIGHT) break;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const x = startX + dx, z = startZ + dz;
          if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y < WORLD_HEIGHT) {
            if (dx === 0 && dz === 0) chunk.set(x, y, z, WOOD);
            else if (h < trunkHeight - 1) chunk.set(x, y, z, WOOD);
          }
        }
      }
    }
    const crownY = startY + trunkHeight - 1;
    const radius = 3;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
          if (dist <= radius + 0.5) {
            const x = startX + dx, z = startZ + dz, y = crownY + dy;
            if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= 0 && y < WORLD_HEIGHT) {
              const cur = chunk.get(x, y, z);
              if (cur === AIR || cur === LEAVES) chunk.set(x, y, z, LEAVES);
            }
          }
        }
      }
    }
    for (let dy = -1; dy <= 1; dy++) {
      const y = crownY + dy;
      if (y >= 0 && y < WORLD_HEIGHT && startX >= 0 && startX < CHUNK_SIZE && startZ >= 0 && startZ < CHUNK_SIZE)
        chunk.set(startX, y, startZ, WOOD);
    }
  }

  setBlock(wx, wy, wz, type) {
    if (wy < 0 || wy >= WORLD_HEIGHT) return [];
    this.edits.set(`${wx},${wy},${wz}`, type);
    const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return [];
    const lx = wx - cx * CHUNK_SIZE, lz = wz - cz * CHUNK_SIZE;
    chunk.set(lx, wy, lz, type);
    const dirty = [chunk];
    if (lx === 0)              dirty.push(this.getChunk(cx-1, cz));
    if (lx === CHUNK_SIZE-1)   dirty.push(this.getChunk(cx+1, cz));
    if (lz === 0)              dirty.push(this.getChunk(cx, cz-1));
    if (lz === CHUNK_SIZE-1)   dirty.push(this.getChunk(cx, cz+1));
    return dirty.filter(Boolean);
  }
}

// ---------- Greedy meshing (zero-allocation hot path) ----------
export function buildChunkMesh(world, chunk) {
  const wx0 = chunk.cx * CHUNK_SIZE, wz0 = chunk.cz * CHUNK_SIZE;
  const c0 = chunk.blocks;
  const cXm = world.getChunk(chunk.cx - 1, chunk.cz)?.blocks;
  const cXp = world.getChunk(chunk.cx + 1, chunk.cz)?.blocks;
  const cZm = world.getChunk(chunk.cx, chunk.cz - 1)?.blocks;
  const cZp = world.getChunk(chunk.cx, chunk.cz + 1)?.blocks;

  const getTypeFast = (x, y, z) => {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    const yy = y * CHUNK_SIZE * CHUNK_SIZE;
    if (x < 0)      return cXm ? cXm[(x & 15) + z * CHUNK_SIZE + yy] : AIR;
    if (x >= 16)    return cXp ? cXp[(x & 15) + z * CHUNK_SIZE + yy] : AIR;
    if (z < 0)      return cZm ? cZm[x + (z & 15) * CHUNK_SIZE + yy] : AIR;
    if (z >= 16)    return cZp ? cZp[x + (z & 15) * CHUNK_SIZE + yy] : AIR;
    return c0[x + z * CHUNK_SIZE + yy];
  };

  const MAX_QUADS = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT * 3;
  const MAX_VERTS = MAX_QUADS * 4;
  const MAX_IDX   = MAX_QUADS * 6;

  const pos = new Float32Array(MAX_VERTS * 3);
  const nrm = new Float32Array(MAX_VERTS * 3);
  const col = new Float32Array(MAX_VERTS * 3);
  const idx = new Uint32Array(MAX_IDX);

  let vp = 0, ip = 0;

  const x = [0,0,0], q = [0,0,0];
  const du = [0,0,0], dv = [0,0,0];
  const dims = [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE];

  for (let d = 0; d < 3; d++) {
    const u = (d+1)%3, v = (d+2)%3;
    q[0]=q[1]=q[2]=0; q[d]=1;
    du[0]=du[1]=du[2]=dv[0]=dv[1]=dv[2]=0;
    du[u]=1; dv[v]=1;
    const dimU = dims[u], dimV = dims[v];
    const mask = new Int16Array(dimU * dimV);

    for (x[d] = -1; x[d] < dims[d];) {
      let n = 0;
      for (x[v]=0; x[v]<dimV; x[v]++)
        for (x[u]=0; x[u]<dimU; x[u]++, n++) {
          const a = getTypeFast(x[0], x[1], x[2]);
          const b = getTypeFast(x[0]+q[0], x[1]+q[1], x[2]+q[2]);
          mask[n] = (a !== AIR) === (b !== AIR) ? 0 : (a !== AIR ? a : -b);
        }

      x[d]++;
      n = 0;
      for (let j = 0; j < dimV; j++)
        for (let i = 0; i < dimU;) {
          const cell = mask[n];
          if (cell === 0) { i++; n++; continue; }
          let w = 1;
          while (i + w < dimU && mask[n+w] === cell) w++;
          let h = 1;
          outer: for (; j+h < dimV; h++)
            for (let k = 0; k < w; k++)
              if (mask[n + k + h*dimU] !== cell) break outer;

          x[u] = i; x[v] = j;
          du[u] = w; dv[v] = h;

          const px = x[0]+wx0, py = x[1], pz = x[2]+wz0;
          const type = Math.abs(cell);
          const backface = cell < 0;
          const nx = backface ? -(du[1]*dv[2]-du[2]*dv[1]) : (du[1]*dv[2]-du[2]*dv[1]);
          const ny = backface ? -(du[2]*dv[0]-du[0]*dv[2]) : (du[2]*dv[0]-du[0]*dv[2]);
          const nz = backface ? -(du[0]*dv[1]-du[1]*dv[0]) : (du[0]*dv[1]-du[1]*dv[0]);
          const l = Math.sqrt(nx*nx+ny*ny+nz*nz)||1;
          const inv = 1/l;
          const fnx = nx*inv, fny = ny*inv, fnz = nz*inv;

          const cr = CR[type], cg = CG[type], cb = CB[type];

          const x0=px,               y0=py,               z0=pz;
          const x1=px+du[0],         y1=py+du[1],         z1=pz+du[2];
          const x2=px+du[0]+dv[0],   y2=py+du[1]+dv[1],   z2=pz+du[2]+dv[2];
          const x3=px+dv[0],         y3=py+dv[1],         z3=pz+dv[2];

          const base = vp / 3;

          pos[vp]=x0; nrm[vp]=fnx; col[vp]=cr; vp++;
          pos[vp]=y0; nrm[vp]=fny; col[vp]=cg; vp++;
          pos[vp]=z0; nrm[vp]=fnz; col[vp]=cb; vp++;

          pos[vp]=x1; nrm[vp]=fnx; col[vp]=cr; vp++;
          pos[vp]=y1; nrm[vp]=fny; col[vp]=cg; vp++;
          pos[vp]=z1; nrm[vp]=fnz; col[vp]=cb; vp++;

          pos[vp]=x2; nrm[vp]=fnx; col[vp]=cr; vp++;
          pos[vp]=y2; nrm[vp]=fny; col[vp]=cg; vp++;
          pos[vp]=z2; nrm[vp]=fnz; col[vp]=cb; vp++;

          pos[vp]=x3; nrm[vp]=fnx; col[vp]=cr; vp++;
          pos[vp]=y3; nrm[vp]=fny; col[vp]=cg; vp++;
          pos[vp]=z3; nrm[vp]=fnz; col[vp]=cb; vp++;

          if (backface) {
            idx[ip++] = base;   idx[ip++] = base+2; idx[ip++] = base+1;
            idx[ip++] = base;   idx[ip++] = base+3; idx[ip++] = base+2;
          } else {
            idx[ip++] = base;   idx[ip++] = base+1; idx[ip++] = base+2;
            idx[ip++] = base;   idx[ip++] = base+2; idx[ip++] = base+3;
          }

          for (let l = 0; l < h; l++)
            for (let k = 0; k < w; k++) mask[n + k + l*dimU] = 0;
          i += w; n += w;
          du[u] = 0; dv[v] = 0;
        }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos.subarray(0, vp), 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(nrm.subarray(0, vp), 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(col.subarray(0, vp), 3));
  geo.setIndex(new THREE.Uint32BufferAttribute(idx.subarray(0, ip), 1));
  const mesh = new THREE.Mesh(geo, CHUNK_MATERIAL);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// ---------- LOD superchunk: 4x4 chunks (64x64 blocks) merged ----------
export function buildLODChunkMesh(world, scx, scz) {
  const SUPER = 4;         // 1 superchunk = 4x4 ordinary chunks
  const SCALE = 4;         // 1 LOD column = 4x4 blocks
  const COLS = (CHUNK_SIZE * SUPER) / SCALE; // 16 columns per side
  const SIZE = CHUNK_SIZE * SUPER;         // 64 blocks total size
  
  const positions = [], normals = [], colors = [], indices = [];
  const wx0 = scx * SIZE;
  const wz0 = scz * SIZE;

  // Precompute heights for the whole 64x64 area
  const heights = new Float32Array(COLS * COLS);
  for (let lz = 0; lz < COLS; lz++) {
    for (let lx = 0; lx < COLS; lx++) {
      const wx = wx0 + lx * SCALE + SCALE * 0.5;
      const wz = wz0 + lz * SCALE + SCALE * 0.5;
      const hRaw = world.terrainHeight(wx, wz);
      heights[lx + lz * COLS] = Math.max(1, Math.min(WORLD_HEIGHT - 1, Math.floor(hRaw)));
    }
  }

  for (let lz = 0; lz < COLS; lz++) {
    for (let lx = 0; lx < COLS; lx++) {
      const idx = lx + lz * COLS;
      const h = heights[idx];

      const wx = wx0 + lx * SCALE + SCALE * 0.5;
      const wz = wz0 + lz * SCALE + SCALE * 0.5;
      const biome = world.getBiome(wx, wz);
      let topType = GRASS;
      if (biome === 'desert') topType = SAND;
      else if (biome === 'mountain') topType = STONE;
      const c = BLOCK_COLORS[topType];

      const x0 = wx0 + lx * SCALE;
      const x1 = x0 + SCALE;
      const z0 = wz0 + lz * SCALE;
      const z1 = z0 + SCALE;

      const base = positions.length / 3;
      // Top face only — enough for distant terrain
      positions.push(x0, h, z1, x1, h, z1, x1, h, z0, x0, h, z0);
      for (let i = 0; i < 4; i++) {
        normals.push(0, 1, 0);
        colors.push(c.r, c.g, c.b);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  if (!positions.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  const mesh = new THREE.Mesh(geo, CHUNK_MATERIAL);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}