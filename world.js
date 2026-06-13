import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const WOOD = 4;
export const LEAVES = 5;
export const PLANKS = 6;
export const SAND = 7;
export const GRAVEL = 8;
export const COAL_ORE = 9;
export const IRON_ORE = 10;

export const BLOCK_COLORS = {
  [GRASS]: new THREE.Color(0x7cb518),
  [DIRT]:  new THREE.Color(0x8b5a2b),
  [STONE]: new THREE.Color(0x808080),
  [WOOD]:  new THREE.Color(0xbc9a6c),
  [LEAVES]: new THREE.Color(0x2e7d32),
  [PLANKS]: new THREE.Color(0xc99e6f),
  [SAND]:  new THREE.Color(0xf4e2b9),
  [GRAVEL]: new THREE.Color(0x9e9e9e),
  [COAL_ORE]: new THREE.Color(0x2c2c2c),
  [IRON_ORE]: new THREE.Color(0xb87333),
};
export const CHUNK_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
    this.mesh = null;
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

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const wx = ox + x, wz = oz + z;
        const height = this.terrainHeight(wx, wz);
        const biome = this.getBiome(wx, wz);
        for (let y = 0; y < height; y++) {
          let block = STONE;
          if (y === height - 1) {
            if (biome === 'desert') block = SAND;
            else block = GRASS;
          } else if (y >= height - 4) {
            block = DIRT;
          } else {
            block = STONE;
            if (y < 40 && this.noise.noise(wx * 0.1, y * 0.1, wz * 0.1) > 0.85)
              block = IRON_ORE;
            else if (y < 60 && this.noise.noise(wx * 0.12, y * 0.12, wz * 0.12) > 0.7)
              block = COAL_ORE;
          }
          chunk.set(x, y, z, block);
        }
        if (biome === 'desert' && height < WORLD_HEIGHT-1 && Math.random() < 0.3) {
          chunk.set(x, height, z, SAND);
        }
      }
    }

    if (this.getBiome(ox + 8, oz + 8) === 'forest' && Math.random() < 0.1) {
      const groundY = this.terrainHeight(ox + 8, oz + 8);
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
    const startX = cx, startZ = cz;
    const startY = groundY;
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
              const current = chunk.get(x, y, z);
              if (current === AIR || current === LEAVES) chunk.set(x, y, z, LEAVES);
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

// ---------- Greedy meshing ----------
export function buildChunkMesh(world, chunk) {
  const positions = [], normals = [], colors = [], indices = [];
  const dims = [CHUNK_SIZE, WORLD_HEIGHT, CHUNK_SIZE];
  const wx0 = chunk.cx * CHUNK_SIZE, wz0 = chunk.cz * CHUNK_SIZE;
  const getType = (x, y, z) => {
    if (y < 0 || y >= WORLD_HEIGHT) return AIR;
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE)
      return world.getBlock(wx0 + x, y, wz0 + z);
    return chunk.get(x, y, z);
  };
  function emitQuad(px, py, pz, du, dv, type, backface) {
    const c = BLOCK_COLORS[type];
    const base = positions.length / 3;
    let nx = du[1] * dv[2] - du[2] * dv[1];
    let ny = du[2] * dv[0] - du[0] * dv[2];
    let nz = du[0] * dv[1] - du[1] * dv[0];
    const l = Math.hypot(nx, ny, nz);
    nx /= l; ny /= l; nz /= l;
    if (backface) { nx = -nx; ny = -ny; nz = -nz; }
    const verts = [
      [px, py, pz],
      [px + du[0], py + du[1], pz + du[2]],
      [px + du[0] + dv[0], py + du[1] + dv[1], pz + du[2] + dv[2]],
      [px + dv[0], py + dv[1], pz + dv[2]],
    ];
    for (const [x, y, z] of verts) {
      positions.push(x, y, z); normals.push(nx, ny, nz); colors.push(c.r, c.g, c.b);
    }
    if (backface) indices.push(base, base+2, base+1, base, base+3, base+2);
    else indices.push(base, base+1, base+2, base, base+2, base+3);
  }
  const x = [0,0,0], q = [0,0,0];
  for (let d = 0; d < 3; d++) {
    const u = (d+1)%3, v = (d+2)%3;
    q[0]=q[1]=q[2]=0; q[d]=1;
    const mask = new Int16Array(dims[u] * dims[v]);
    for (x[d] = -1; x[d] < dims[d];) {
      let n = 0;
      for (x[v]=0; x[v]<dims[v]; x[v]++)
        for (x[u]=0; x[u]<dims[u]; x[u]++, n++) {
          const a = getType(x[0], x[1], x[2]);
          const b = getType(x[0]+q[0], x[1]+q[1], x[2]+q[2]);
          mask[n] = (a !== AIR) === (b !== AIR) ? 0 : (a !== AIR ? a : -b);
        }
      x[d]++;
      n = 0;
      for (let j = 0; j < dims[v]; j++)
        for (let i = 0; i < dims[u];) {
          const cell = mask[n];
          if (cell === 0) { i++; n++; continue; }
          let w = 1;
          while (i+w < dims[u] && mask[n+w] === cell) w++;
          let h = 1;
          outer: for (; j+h < dims[v]; h++)
            for (let k = 0; k < w; k++)
              if (mask[n + k + h*dims[u]] !== cell) break outer;
          x[u] = i; x[v] = j;
          const du = [0,0,0], dv = [0,0,0];
          du[u] = w; dv[v] = h;
          emitQuad(x[0]+wx0, x[1], x[2]+wz0, du, dv, Math.abs(cell), cell < 0);
          for (let l=0; l<h; l++)
            for (let k=0; k<w; k++) mask[n + k + l*dims[u]] = 0;
          i += w; n += w;
        }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal',   new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, CHUNK_MATERIAL);
}

// ---------- LOD меш с увеличенным перекрытием ----------
export function buildLODMesh(world, gx, gz, level) {
  const step = 1 << level;
  const n = CHUNK_SIZE;
  const overlap = 4;
  const totalSteps = n + overlap * 2;
  const ox = gx * n * step - overlap * step;
  const oz = gz * n * step - overlap * step;
  const W = totalSteps + 2;
  const H = new Int16Array(W * W);
  for (let j = -overlap; j < n + overlap; j++) {
    for (let i = -overlap; i < n + overlap; i++) {
      const wx = ox + (i + overlap) * step;
      const wz = oz + (j + overlap) * step;
      H[(i + overlap) + (j + overlap) * W] = world.terrainHeight(wx, wz);
    }
  }
  const h = (i, j) => H[(i + overlap) + (j + overlap) * W];
  const positions = [], normals = [], colors = [], indices = [];
  const Y_OFF = -0.05;
  function quad(verts, normal, c) {
    const base = positions.length / 3;
    for (const [x, y, z] of verts) {
      positions.push(x, y + Y_OFF, z);
      normals.push(...normal);
      colors.push(c.r, c.g, c.b);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const dirt = BLOCK_COLORS[DIRT];
  const stone = BLOCK_COLORS[STONE];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const y = h(i, j);
      const x0 = ox + (i + overlap) * step;
      const z0 = oz + (j + overlap) * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const biome = world.getBiome(x0 + step/2, z0 + step/2);
      let surfaceType = GRASS;
      if (biome === 'desert') surfaceType = SAND;
      else if (biome === 'mountain') surfaceType = STONE;
      const topColor = BLOCK_COLORS[surfaceType];
      quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], topColor);
      const walls = [
        [h(i+1, j), [1,0,0], (a,b) => [[x1,a,z0],[x1,b,z0],[x1,b,z1],[x1,a,z1]]],
        [h(i-1, j), [-1,0,0], (a,b) => [[x0,a,z1],[x0,b,z1],[x0,b,z0],[x0,a,z0]]],
        [h(i,j+1), [0,0,1], (a,b) => [[x0,a,z1],[x1,a,z1],[x1,b,z1],[x0,b,z1]]],
        [h(i,j-1), [0,0,-1], (a,b) => [[x1,a,z0],[x0,a,z0],[x0,b,z0],[x1,b,z0]]],
      ];
      for (const [hn, dir, make] of walls) {
        if (hn < y) quad(make(hn, y), dir, (y - hn) <= 4 ? dirt : stone);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  return new THREE.Mesh(geo, CHUNK_MATERIAL);
}