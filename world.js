import * as THREE from 'three';
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const AIR = 0;
export const GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5;
export const PLANKS = 6, SAND = 7, GRAVEL = 8, COAL_ORE = 9, IRON_ORE = 10;
export const ICE = 11, SNOW_BLOCK = 12, CACTUS = 13;
export const BRICK = 14, OBSIDIAN = 15, GLOWSTONE = 16, MOSSY_STONE = 17, SANDSTONE = 18;
export const NETHERRACK = 19, END_STONE = 20, PURPUR = 21, PRISMARINE = 22, SEA_LANTERN = 23;
export const MAGMA = 24, SOUL_SAND = 25, HONEY = 26, SLIME = 27, BAMBOO = 28;
export const CHERRY_LOG = 29, CHERRY_LEAVES = 30, MUSHROOM_STEM = 31;
export const RED_MUSHROOM = 32, BROWN_MUSHROOM = 33, CORAL = 34, SPONGE = 35;
export const MYCELIUM = 36, TERRACOTTA = 37, PACKED_ICE = 38;

export const BLOCK_COLORS = {
  [GRASS]: new THREE.Color(0x7cb518), [DIRT]: new THREE.Color(0x8b5a2b),
  [STONE]: new THREE.Color(0x808080), [WOOD]: new THREE.Color(0xbc9a6c),
  [LEAVES]: new THREE.Color(0x2e7d32), [PLANKS]: new THREE.Color(0xc99e6f),
  [SAND]: new THREE.Color(0xf4e2b9), [GRAVEL]: new THREE.Color(0x9e9e9e),
  [COAL_ORE]: new THREE.Color(0x2c2c2c), [IRON_ORE]: new THREE.Color(0xb87333),
  [ICE]: new THREE.Color(0x88ccff), [SNOW_BLOCK]: new THREE.Color(0xf0f0f0),
  [CACTUS]: new THREE.Color(0x2c5e1a), [BRICK]: new THREE.Color(0xb85c38),
  [OBSIDIAN]: new THREE.Color(0x1a1a2e), [GLOWSTONE]: new THREE.Color(0xffaa66),
  [MOSSY_STONE]: new THREE.Color(0x5a6b3a), [SANDSTONE]: new THREE.Color(0xd6b575),
  [NETHERRACK]: new THREE.Color(0x4c1e1e), [END_STONE]: new THREE.Color(0xe0dba0),
  [PURPUR]: new THREE.Color(0xba6f9a), [PRISMARINE]: new THREE.Color(0x5f9ea0),
  [SEA_LANTERN]: new THREE.Color(0x88ddcc), [MAGMA]: new THREE.Color(0xd45500),
  [SOUL_SAND]: new THREE.Color(0x6b4c3b), [HONEY]: new THREE.Color(0xe0a800),
  [SLIME]: new THREE.Color(0x7cb518), [BAMBOO]: new THREE.Color(0x5c9e3a),
  [CHERRY_LOG]: new THREE.Color(0xd4816a), [CHERRY_LEAVES]: new THREE.Color(0xffb7c5),
  [MUSHROOM_STEM]: new THREE.Color(0xc2b29b), [RED_MUSHROOM]: new THREE.Color(0xd32f2f),
  [BROWN_MUSHROOM]: new THREE.Color(0x8b5a2b), [CORAL]: new THREE.Color(0xff6b6b),
  [SPONGE]: new THREE.Color(0xe5b73b), [MYCELIUM]: new THREE.Color(0x9c8e6e),
  [TERRACOTTA]: new THREE.Color(0xd28c5c), [PACKED_ICE]: new THREE.Color(0x8ecfe0),
};
export const CHUNK_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

const CR = new Float32Array(40);
const CG = new Float32Array(40);
const CB = new Float32Array(40);
for (let i = 1; i <= 38; i++) {
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

  // Новая система биомов – крупные области, без интерполяции
  getBiome(wx, wz) {
    const s = this.seed;
    // Увеличенный масштаб – биомы в 2-3 раза крупнее
    const val = (this.noise.noise(wx * 0.003 + s, wz * 0.003 + s, 300) + 1) / 2;
    const val2 = (this.noise.noise(wx * 0.008 + s, wz * 0.008 + s, 400) + 1) / 2;
    const val3 = (this.noise.noise(wx * 0.002 + s, wz * 0.002 + s, 500) + 1) / 2;
    if (val < 0.03) return 'coral_reef';
    if (val < 0.06) return 'mushroom';
    if (val < 0.09) return 'cherry_grove';
    if (val < 0.12) return 'bamboo_forest';
    if (val < 0.15) return 'volcanic';
    if (val < 0.18) return 'soul_sand_valley';
    if (val < 0.21) return 'end_highlands';
    if (val < 0.24) return 'nether_wastes';
    if (val < 0.28 && val2 > 0.7) return 'desert';
    if (val < 0.31 && val2 > 0.8) return 'oasis';
    if (val < 0.34 && val3 > 0.8) return 'ice_spikes';
    if (val < 0.37) return 'snow';
    if (val < 0.40) return 'ice';
    if (val < 0.43) return 'taiga';
    if (val < 0.46 && val2 < 0.4) return 'swamp';
    if (val < 0.49 && val2 > 0.7) return 'savanna';
    if (val < 0.52 && val3 > 0.7) return 'mesa';
    if (val < 0.55) return 'forest';
    if (val < 0.58) return 'mountain';
    if (val < 0.70) return 'plains'; // равнины – базовый биом (широкий диапазон)
    if (val < 0.80) return 'jungle';
    return 'dark_forest';
  }

  terrainHeight(wx, wz) {
    // Без интерполяции – резкие границы, как в бета-майнкрафте
    const s = this.seed;
    let h = 24;
    h += this.noise.noise(wx / 60 + s, wz / 60 + s, 0)   * 20;
    h += this.noise.noise(wx / 25 + s, wz / 25 + s, 100) * 8;
    h += this.noise.noise(wx / 10 + s, wz / 10 + s, 200) * 3;
    const biome = this.getBiome(wx, wz);
    if (biome === 'desert') {
      h = 28 + this.noise.noise(wx / 40 + s, wz / 40 + s, 400) * 4;
      h = Math.max(24, Math.min(35, h));
    } else if (biome === 'mountain') {
      h += this.noise.noise(wx / 15 + s, wz / 15 + s, 150) * 25;
      h += Math.abs(this.noise.noise(wx / 5 + s, wz / 5 + s, 250)) * 15;
      h = Math.max(50, Math.min(WORLD_HEIGHT - 10, h));
    } else if (biome === 'ice') {
      h = 25 + this.noise.noise(wx / 35 + s, wz / 35 + s, 500) * 5;
      h = Math.max(20, Math.min(32, h));
    } else if (biome === 'snow') {
      h = 27 + this.noise.noise(wx / 30 + s, wz / 30 + s, 550) * 6;
      h = Math.max(22, Math.min(38, h));
    } else if (biome === 'swamp') {
      h = 21 + this.noise.noise(wx / 20 + s, wz / 20 + s, 600) * 4;
      h = Math.max(18, Math.min(28, h));
    } else if (biome === 'savanna') {
      h = 29 + this.noise.noise(wx / 25 + s, wz / 25 + s, 650) * 7;
      h = Math.max(26, Math.min(42, h));
    } else if (biome === 'coral_reef') {
      h = 18 + this.noise.noise(wx / 18 + s, wz / 18 + s, 700) * 5;
      h = Math.max(15, Math.min(24, h));
    } else if (biome === 'mushroom') {
      h = 23 + this.noise.noise(wx / 22 + s, wz / 22 + s, 750) * 6;
      h = Math.max(20, Math.min(32, h));
    } else if (biome === 'cherry_grove') {
      h = 26 + this.noise.noise(wx / 28 + s, wz / 28 + s, 800) * 7;
      h = Math.max(22, Math.min(38, h));
    } else if (biome === 'bamboo_forest') {
      h = 27 + this.noise.noise(wx / 24 + s, wz / 24 + s, 850) * 6;
      h = Math.max(24, Math.min(40, h));
    } else if (biome === 'volcanic') {
      h = 45 + Math.abs(this.noise.noise(wx / 12 + s, wz / 12 + s, 900)) * 25;
      h = Math.max(55, Math.min(WORLD_HEIGHT - 8, h));
    } else if (biome === 'soul_sand_valley') {
      h = 32 + this.noise.noise(wx / 18 + s, wz / 18 + s, 950) * 10;
      h = Math.max(30, Math.min(48, h));
    } else if (biome === 'end_highlands') {
      h = 38 + this.noise.noise(wx / 16 + s, wz / 16 + s, 1000) * 15;
      h = Math.max(35, Math.min(60, h));
    } else if (biome === 'nether_wastes') {
      h = 35 + this.noise.noise(wx / 20 + s, wz / 20 + s, 1050) * 12;
      h = Math.max(32, Math.min(55, h));
    } else if (biome === 'oasis') {
      h = 26 + this.noise.noise(wx / 22 + s, wz / 22 + s, 1100) * 4;
      h = Math.max(24, Math.min(34, h));
    } else if (biome === 'ice_spikes') {
      h = 28 + this.noise.noise(wx / 20 + s, wz / 20 + s, 1150) * 10;
      h = Math.max(25, Math.min(45, h));
    } else if (biome === 'taiga') {
      h = 28 + this.noise.noise(wx / 25 + s, wz / 25 + s, 1200) * 7;
      h = Math.max(24, Math.min(42, h));
    } else if (biome === 'mesa') {
      h = 35 + this.noise.noise(wx / 18 + s, wz / 18 + s, 1250) * 12;
      h = Math.max(30, Math.min(58, h));
    } else if (biome === 'jungle') {
      h = 24 + this.noise.noise(wx / 20 + s, wz / 20 + s, 1350) * 10;
      h = Math.max(20, Math.min(48, h));
    } else if (biome === 'dark_forest') {
      h = 26 + this.noise.noise(wx / 22 + s, wz / 22 + s, 1400) * 8;
      h = Math.max(22, Math.min(44, h));
    } else { // plains, forest
      h += this.noise.noise(wx / 25 + s, wz / 25 + s, 300) * 8;
      h = Math.max(20, Math.min(50, h));
    }
    return Math.max(1, Math.min(WORLD_HEIGHT - 1, Math.floor(h)));
  }

  // ---------- НОВЫЕ ТИПЫ ДЕРЕВЬЕВ ----------
  generateOakTree(chunk, cx, cz, groundY) {
    const h = 5 + Math.floor(Math.random() * 2);
    for (let y = 0; y < h; y++) {
      chunk.set(cx, groundY + y, cz, WOOD);
    }
    const leafRad = 2;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -leafRad; dx <= leafRad; dx++) {
        for (let dz = -leafRad; dz <= leafRad; dz++) {
          const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
          if (dist <= leafRad + 0.5 && (dy + h) > 0) {
            chunk.set(cx + dx, groundY + h - 1 + dy, cz + dz, LEAVES);
          }
        }
      }
    }
  }

  generatePineTree(chunk, cx, cz, groundY) {
    const h = 7 + Math.floor(Math.random() * 4);
    for (let y = 0; y < h; y++) {
      chunk.set(cx, groundY + y, cz, WOOD);
    }
    for (let i = 0; i < 4; i++) {
      const yOff = h - 2 - i * 2;
      const rad = 2 - i;
      if (rad < 1) continue;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= rad) {
            chunk.set(cx + dx, groundY + yOff + i, cz + dz, LEAVES);
          }
        }
      }
    }
  }

  generatePalmTree(chunk, cx, cz, groundY) {
    const h = 4 + Math.floor(Math.random() * 3);
    for (let y = 0; y < h; y++) {
      chunk.set(cx, groundY + y, cz, WOOD);
    }
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 2) {
          chunk.set(cx + dx, groundY + h - 1, cz + dz, LEAVES);
        }
      }
    }
    chunk.set(cx, groundY + h, cz, LEAVES);
    chunk.set(cx + 1, groundY + h, cz, LEAVES);
    chunk.set(cx - 1, groundY + h, cz, LEAVES);
  }

  generateCherryTree(chunk, cx, cz, groundY) {
    const h = 4 + Math.floor(Math.random() * 3);
    for (let y = 0; y < h; y++) {
      chunk.set(cx, groundY + y, cz, CHERRY_LOG);
    }
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 2) {
          chunk.set(cx + dx, groundY + h - 1, cz + dz, CHERRY_LEAVES);
        }
      }
    }
  }

  generateSwampTree(chunk, cx, cz, groundY) {
    const h = 5 + Math.floor(Math.random() * 2);
    for (let y = 0; y < h; y++) {
      chunk.set(cx, groundY + y, cz, WOOD);
    }
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= 2) {
            chunk.set(cx + dx, groundY + h - 1 + dy, cz + dz, LEAVES);
          }
        }
      }
    }
    // Виноградные лозы (листья свисают)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let i = 1; i <= 2; i++) {
          chunk.set(cx + dx, groundY + h - 1 - i, cz + dz, LEAVES);
        }
      }
    }
  }

  generateGiantTree(chunk, cx, cz, groundY) {
    const h = 8 + Math.floor(Math.random() * 5);
    for (let y = 0; y < h; y++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          if (dx === 0 && dz === 0) chunk.set(cx, groundY + y, cz, WOOD);
          else if (y < h - 2) chunk.set(cx + dx, groundY + y, cz + dz, WOOD);
        }
      }
    }
    const rad = 4;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
          if (dist <= rad) {
            chunk.set(cx + dx, groundY + h - 2 + dy, cz + dz, LEAVES);
          }
        }
      }
    }
  }

  generateDeadTree(chunk, cx, cz, groundY) {
    const h = 3 + Math.floor(Math.random() * 3);
    for (let y = 0; y < h; y++) {
      chunk.set(cx, groundY + y, cz, WOOD);
    }
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.random() < 0.3) {
          chunk.set(cx + dx, groundY + h - 1, cz + dz, WOOD);
        }
      }
    }
  }

  generateJungleTree(chunk, cx, cz, groundY) {
    const h = 6 + Math.floor(Math.random() * 5);
    for (let y = 0; y < h; y++) {
      chunk.set(cx, groundY + y, cz, WOOD);
    }
    const rad = 3;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          const dist = Math.sqrt(dx*dx + dz*dz + dy*dy);
          if (dist <= rad) {
            chunk.set(cx + dx, groundY + h - 2 + dy, cz + dz, LEAVES);
          }
        }
      }
    }
    // Лианы
    for (let i = 1; i <= 3; i++) {
      chunk.set(cx + 1, groundY + h - i, cz, LEAVES);
      chunk.set(cx - 1, groundY + h - i, cz, LEAVES);
    }
  }

  generateMegaTaigaTree(chunk, cx, cz, groundY) {
    const h = 12 + Math.floor(Math.random() * 5);
    const trunkW = 2;
    for (let y = 0; y < h; y++) {
      for (let dx = -trunkW; dx <= trunkW; dx++) {
        for (let dz = -trunkW; dz <= trunkW; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= trunkW) {
            chunk.set(cx + dx, groundY + y, cz + dz, WOOD);
          }
        }
      }
    }
    for (let i = 0; i < 5; i++) {
      const yOff = h - 3 - i * 2;
      const rad = 3 - i;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= rad) {
            chunk.set(cx + dx, groundY + yOff + i, cz + dz, LEAVES);
          }
        }
      }
    }
  }

  // ---------- СТРУКТУРЫ (очень редкие) ----------
  generatePortal(chunk, cx, cz, groundY) {
    const obsidian = OBSIDIAN;
    const size = 7;
    const startX = cx - Math.floor(size/2);
    const startZ = cz - Math.floor(size/2);
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        if (x === 0 || x === size-1 || z === 0 || z === size-1) {
          for (let y = 0; y < size; y++) {
            if (y === size-1) continue;
            chunk.set(startX + x, groundY + y, startZ + z, obsidian);
          }
        }
      }
    }
    // Внутренность портала (воздух)
    for (let x = 1; x < size-1; x++) {
      for (let z = 1; z < size-1; z++) {
        for (let y = 1; y < size-1; y++) {
          chunk.set(startX + x, groundY + y, startZ + z, AIR);
        }
      }
    }
  }

  generateStoneCircle(chunk, cx, cz, groundY) {
    const radius = 4;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const dx = Math.round(Math.cos(angle) * radius);
      const dz = Math.round(Math.sin(angle) * radius);
      chunk.set(cx + dx, groundY, cz + dz, STONE);
      chunk.set(cx + dx, groundY + 1, cz + dz, MOSSY_STONE);
    }
  }

  generateDruidAltar(chunk, cx, cz, groundY) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        chunk.set(cx + dx, groundY, cz + dz, STONE);
      }
    }
    chunk.set(cx, groundY + 1, cz, GLOWSTONE);
    chunk.set(cx, groundY + 2, cz, AIR);
  }

  generateSmallPyramid(chunk, cx, cz, groundY) {
    const stone = SANDSTONE;
    for (let y = 0; y < 3; y++) {
      const s = 3 - y;
      for (let dx = -s; dx <= s; dx++) {
        for (let dz = -s; dz <= s; dz++) {
          if (Math.abs(dx) === s || Math.abs(dz) === s) {
            chunk.set(cx + dx, groundY + y, cz + dz, stone);
          }
        }
      }
    }
  }

  generateRuins(chunk, cx, cz, groundY) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.random() < 0.6) {
          chunk.set(cx + dx, groundY, cz + dz, MOSSY_STONE);
          if (Math.random() < 0.3) chunk.set(cx + dx, groundY + 1, cz + dz, MOSSY_STONE);
        }
      }
    }
  }

  generateDolmen(chunk, cx, cz, groundY) {
    for (let i = -1; i <= 1; i++) {
      chunk.set(cx + i, groundY, cz, STONE);
      chunk.set(cx + i, groundY + 1, cz, STONE);
      chunk.set(cx + i, groundY + 2, cz, STONE);
    }
    for (let i = -1; i <= 1; i++) {
      chunk.set(cx + i, groundY + 3, cz - 1, STONE);
      chunk.set(cx + i, groundY + 3, cz + 1, STONE);
    }
    chunk.set(cx, groundY + 3, cz, STONE);
  }

  generateWell(chunk, cx, cz, groundY) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        chunk.set(cx + dx, groundY, cz + dz, STONE);
      }
    }
    chunk.set(cx, groundY + 1, cz, WATER); // вода, если определена
    chunk.set(cx, groundY + 2, cz, AIR);
  }

  generateTotemPole(chunk, cx, cz, groundY) {
    const wood = WOOD;
    for (let y = 0; y < 4; y++) {
      chunk.set(cx, groundY + y, cz, wood);
    }
    chunk.set(cx, groundY + 4, cz, PLANKS);
    chunk.set(cx, groundY + 5, cz, PLANKS);
    chunk.set(cx + 1, groundY + 4, cz, PLANKS);
    chunk.set(cx - 1, groundY + 4, cz, PLANKS);
  }

  generateHangingGarden(chunk, cx, cz, groundY) {
    for (let y = 0; y < 3; y++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= 2) {
            chunk.set(cx + dx, groundY + y, cz + dz, DIRT);
          }
        }
      }
    }
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 2) {
          chunk.set(cx + dx, groundY + 3, cz + dz, GRASS);
          if (Math.random() < 0.5) chunk.set(cx + dx, groundY + 4, cz + dz, LEAVES);
        }
      }
    }
  }

  generateIceSpike(chunk, cx, cz, groundY) {
    const h = 5 + Math.floor(Math.random() * 6);
    for (let y = 0; y < h; y++) {
      const rad = Math.max(0, Math.floor((h - y) / 2));
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= rad) {
            chunk.set(cx + dx, groundY + y, cz + dz, PACKED_ICE);
          }
        }
      }
    }
  }

  // ------------------------------------------------------------
  // Генерация чанка
  generateChunk(cx, cz) {
    const chunk = new Chunk(cx, cz);
    const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;

    const heights = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomes = new Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x, wz = oz + z;
        heights[x + z * CHUNK_SIZE] = this.terrainHeight(wx, wz);
        biomes[x + z * CHUNK_SIZE] = this.getBiome(wx, wz);
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
            if (biome === 'desert') block = SAND;
            else if (biome === 'oasis') block = GRASS;
            else if (biome === 'ice' || biome === 'ice_spikes') block = ICE;
            else if (biome === 'snow') block = SNOW_BLOCK;
            else if (biome === 'coral_reef') block = SAND;
            else if (biome === 'mushroom') block = MYCELIUM;
            else if (biome === 'cherry_grove') block = GRASS;
            else if (biome === 'bamboo_forest') block = GRASS;
            else if (biome === 'volcanic') block = MAGMA;
            else if (biome === 'soul_sand_valley') block = SOUL_SAND;
            else if (biome === 'end_highlands') block = END_STONE;
            else if (biome === 'nether_wastes') block = NETHERRACK;
            else if (biome === 'taiga') block = GRASS;
            else if (biome === 'mesa') block = TERRACOTTA;
            else if (biome === 'plains') block = GRASS;
            else if (biome === 'jungle') block = GRASS;
            else if (biome === 'dark_forest') block = GRASS;
            else block = GRASS;
          } else if (y >= height - 4) {
            if (biome === 'snow' || biome === 'ice') block = PACKED_ICE;
            else block = DIRT;
          } else {
            if (y < 40 && this.noise.noise((ox + x) * 0.1, y * 0.1, (oz + z) * 0.1) > 0.85)
              block = IRON_ORE;
            else if (y < 60 && this.noise.noise((ox + x) * 0.12, y * 0.12, (oz + z) * 0.12) > 0.7)
              block = COAL_ORE;
          }
          chunk.set(x, y, z, block);
        }

        // Декорации
        if (biome === 'snow' && height < WORLD_HEIGHT - 1 && Math.random() < 0.2) {
          chunk.set(x, height, z, SNOW_BLOCK);
        }
        if (biome === 'desert' && Math.random() < 0.02) {
          const cactusHeight = 1 + Math.floor(Math.random() * 2);
          for (let h = 0; h < cactusHeight; h++) {
            const yy = height + h;
            if (yy < WORLD_HEIGHT) chunk.set(x, yy, z, CACTUS);
          }
        }
        if (biome === 'bamboo_forest' && Math.random() < 0.04) {
          chunk.set(x, height, z, BAMBOO);
        }
      }
    }

    // Редкие деревья (2% на чанк, в зависимости от биома)
    if (Math.random() < 0.02) {
      const cxTree = Math.floor(CHUNK_SIZE / 2);
      const czTree = Math.floor(CHUNK_SIZE / 2);
      const groundY = heights[cxTree + czTree * CHUNK_SIZE];
      const biome = biomes[cxTree + czTree * CHUNK_SIZE];
      if (groundY > 2 && groundY < WORLD_HEIGHT - 8) {
        if (biome === 'taiga') this.generatePineTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'jungle') this.generateJungleTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'cherry_grove') this.generateCherryTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'swamp') this.generateSwampTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'dark_forest') this.generateGiantTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'desert') this.generateDeadTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'savanna') this.generatePalmTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'forest') this.generateOakTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'plains') this.generateOakTree(chunk, cxTree, czTree, groundY);
        else if (biome === 'mountain') this.generatePineTree(chunk, cxTree, czTree, groundY);
      }
    }

    // Редкие структуры (0.5% на чанк)
    if (Math.random() < 0.005) {
      const centerX = Math.floor(CHUNK_SIZE / 2);
      const centerZ = Math.floor(CHUNK_SIZE / 2);
      const groundY = heights[centerX + centerZ * CHUNK_SIZE];
      const biome = biomes[centerX + centerZ * CHUNK_SIZE];
      const r = Math.random();
      if (biome === 'plains' && r < 0.15) this.generatePortal(chunk, centerX, centerZ, groundY);
      else if (biome === 'plains' && r < 0.3) this.generateStoneCircle(chunk, centerX, centerZ, groundY);
      else if (biome === 'forest' && r < 0.2) this.generateDruidAltar(chunk, centerX, centerZ, groundY);
      else if (biome === 'desert' && r < 0.25) this.generateSmallPyramid(chunk, centerX, centerZ, groundY);
      else if (biome === 'mountain' && r < 0.2) this.generateRuins(chunk, centerX, centerZ, groundY);
      else if (biome === 'ice' && r < 0.2) this.generateIceSpike(chunk, centerX, centerZ, groundY);
      else if (biome === 'snow' && r < 0.2) this.generateIgloo(chunk, centerX, centerZ, groundY);
      else if (biome === 'savanna' && r < 0.2) this.generateDolmen(chunk, centerX, centerZ, groundY);
      else if (biome === 'swamp' && r < 0.2) this.generateWell(chunk, centerX, centerZ, groundY);
      else if (biome === 'mesa' && r < 0.2) this.generateTotemPole(chunk, centerX, centerZ, groundY);
      else if (biome === 'jungle' && r < 0.2) this.generateHangingGarden(chunk, centerX, centerZ, groundY);
      else if (biome === 'coral_reef') this.generateShipwreck(chunk, centerX, centerZ, groundY);
      else if (biome === 'mushroom') this.generateGiantMushroom(chunk, centerX, centerZ, groundY);
      else if (biome === 'volcanic') this.generateObsidianTower(chunk, centerX, centerZ, groundY);
      else if (biome === 'end_highlands') this.generateEndCity(chunk, centerX, centerZ, groundY);
      else this.generateHouse(chunk, centerX, centerZ, groundY);
    }

    // Применение сохранённых правок
    for (const [key, t] of this.edits) {
      const [ex, ey, ez] = key.split(',').map(Number);
      if (Math.floor(ex / CHUNK_SIZE) === cx && Math.floor(ez / CHUNK_SIZE) === cz) {
        chunk.set(ex - cx * CHUNK_SIZE, ey, ez - cz * CHUNK_SIZE, t);
      }
    }

    this.chunks.set(this.key(cx, cz), chunk);
    return chunk;
  }

  // Вспомогательные методы для структур (копия из предыдущей версии, но с обновлёнными блоками)
  generateHouse(chunk, cx, cz, groundY) {
    const wood = WOOD, planks = PLANKS;
    const width = 8, height = 6, depth = 8;
    const startX = cx - width/2, startZ = cz - depth/2;
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
          const wx = startX + x, wz = startZ + z, wy = groundY + y;
          if (wx < 0 || wx >= CHUNK_SIZE || wz < 0 || wz >= CHUNK_SIZE) continue;
          if (wy >= WORLD_HEIGHT) continue;
          if (x === 0 || x === width-1 || z === 0 || z === depth-1 || y === 0 || y === height-1) {
            if (z === 0 && x >= 3 && x <= 4 && y >= 1 && y <= 2) continue;
            chunk.set(wx, wy, wz, (y === 0) ? planks : wood);
          }
        }
      }
    }
  }

  generatePyramid(chunk, cx, cz, groundY) {
    const stone = SANDSTONE;
    const size = 9;
    const startX = cx - Math.floor(size/2), startZ = cz - Math.floor(size/2);
    for (let y = 0; y < size; y++) {
      const s = size - y;
      for (let x = 0; x < s; x++) {
        for (let z = 0; z < s; z++) {
          const wx = startX + x + y/2, wz = startZ + z + y/2, wy = groundY + y;
          if (wx < 0 || wx >= CHUNK_SIZE || wz < 0 || wz >= CHUNK_SIZE) continue;
          if (wy >= WORLD_HEIGHT) continue;
          if (x === 0 || x === s-1 || z === 0 || z === s-1 || y === size-1) {
            chunk.set(wx, wy, wz, stone);
          }
        }
      }
    }
  }

  generateIgloo(chunk, cx, cz, groundY) {
    const ice = ICE, snow = SNOW_BLOCK;
    const radius = 4;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist > radius) continue;
        const wx = cx + dx, wz = cz + dz;
        if (wx < 0 || wx >= CHUNK_SIZE || wz < 0 || wz >= CHUNK_SIZE) continue;
        const height = Math.floor(radius - dist);
        for (let y = 0; y <= height; y++) {
          const wy = groundY + y;
          if (wy >= WORLD_HEIGHT) continue;
          chunk.set(wx, wy, wz, y === height ? snow : ice);
        }
      }
    }
    chunk.set(cx, groundY + 1, cz - radius, AIR);
  }

  generateJungleTemple(chunk, cx, cz, groundY) {
    const stone = MOSSY_STONE;
    const width = 8, height = 6, depth = 8;
    const startX = cx - width/2, startZ = cz - depth/2;
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
          const wx = startX + x, wz = startZ + z, wy = groundY + y;
          if (wx < 0 || wx >= CHUNK_SIZE || wz < 0 || wz >= CHUNK_SIZE) continue;
          if (wy >= WORLD_HEIGHT) continue;
          if (x === 0 || x === width-1 || z === 0 || z === depth-1 || y === 0 || y === height-1) {
            if (z === 0 && x >= 3 && x <= 4 && y >= 1 && y <= 2) continue;
            chunk.set(wx, wy, wz, stone);
          }
        }
      }
    }
  }

  generateWitchHut(chunk, cx, cz, groundY) {
    const wood = WOOD, planks = PLANKS;
    const width = 7, height = 5, depth = 7;
    const startX = cx - width/2, startZ = cz - depth/2;
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        const wy = groundY;
        if (wy >= WORLD_HEIGHT) continue;
        if (Math.abs(x - width/2) < 2 && Math.abs(z - depth/2) < 2) {
          chunk.set(startX+x, wy, startZ+z, planks);
        } else {
          chunk.set(startX+x, wy-1, startZ+z, WOOD);
        }
        if (x === 0 || x === width-1 || z === 0 || z === depth-1) {
          for (let y = 1; y < height; y++) {
            const wy2 = groundY + y;
            if (wy2 >= WORLD_HEIGHT) continue;
            chunk.set(startX+x, wy2, startZ+z, wood);
          }
        }
      }
    }
  }

  generateShipwreck(chunk, cx, cz, groundY) {
    const wood = WOOD, planks = PLANKS;
    const length = 10, width = 4, height = 3;
    const startX = cx - length/2, startZ = cz - width/2;
    for (let l = 0; l < length; l++) {
      for (let w = 0; w < width; w++) {
        for (let h = 0; h < height; h++) {
          const wx = startX + l, wz = startZ + w, wy = groundY + h;
          if (wx < 0 || wx >= CHUNK_SIZE || wz < 0 || wz >= CHUNK_SIZE) continue;
          if (wy >= WORLD_HEIGHT) continue;
          if (h === 0) chunk.set(wx, wy, wz, planks);
          else if (l === 0 || l === length-1 || w === 0 || w === width-1) {
            chunk.set(wx, wy, wz, wood);
          }
        }
      }
    }
  }

  generateGiantMushroom(chunk, cx, cz, groundY) {
    const stem = MUSHROOM_STEM, cap = RED_MUSHROOM;
    const height = 6, capRadius = 4;
    for (let y = 0; y < height; y++) {
      chunk.set(cx, groundY + y, cz, stem);
    }
    for (let dx = -capRadius; dx <= capRadius; dx++) {
      for (let dz = -capRadius; dz <= capRadius; dz++) {
        const dist = Math.sqrt(dx*dx + dz*dz);
        if (dist <= capRadius) {
          chunk.set(cx+dx, groundY+height-1, cz+dz, cap);
        }
      }
    }
  }

  generateObsidianTower(chunk, cx, cz, groundY) {
    const obsidian = OBSIDIAN;
    const height = 12, width = 3;
    for (let y = 0; y < height; y++) {
      for (let x = -width; x <= width; x++) {
        for (let z = -width; z <= width; z++) {
          if (Math.abs(x) === width || Math.abs(z) === width || y === 0 || y === height-1) {
            if (cx + x >= 0 && cx + x < CHUNK_SIZE && cz + z >= 0 && cz + z < CHUNK_SIZE) {
              chunk.set(cx+x, groundY+y, cz+z, obsidian);
            }
          }
        }
      }
    }
  }

  generateEndCity(chunk, cx, cz, groundY) {
    const endStone = END_STONE, purpur = PURPUR;
    const height = 8;
    for (let y = 0; y < height; y++) {
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          if (Math.abs(x) === 2 && Math.abs(z) === 2) continue;
          chunk.set(cx+x, groundY+y, cz+z, (y % 2 === 0) ? purpur : endStone);
        }
      }
    }
  }

  generateDungeon(chunk, cx, cz, groundY) {
    const stone = STONE, moss = MOSSY_STONE;
    for (let y = 0; y < 3; y++) {
      for (let x = -1; x <= 1; x++) {
        chunk.set(cx+x, groundY + y + 1, cz, (y === 1 && x === 0) ? AIR : stone);
      }
    }
    const roomY = groundY - 3;
    for (let x = -3; x <= 3; x++) {
      for (let z = -3; z <= 3; z++) {
        for (let y = -2; y <= 2; y++) {
          const wy = roomY + y;
          if (wy < 0) continue;
          if (Math.abs(x) === 3 || Math.abs(z) === 3 || y === -2 || y === 2) {
            chunk.set(cx+x, wy, cz+z, moss);
          } else {
            chunk.set(cx+x, wy, cz+z, AIR);
          }
        }
      }
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

// ------------------------------------------------------------
// buildChunkMesh и buildLODChunkMesh (оставляем как в оригинале)
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

          const x0=px, y0=py, z0=pz;
          const x1=px+du[0], y1=py+du[1], z1=pz+du[2];
          const x2=px+du[0]+dv[0], y2=py+du[1]+dv[1], z2=pz+du[2]+dv[2];
          const x3=px+dv[0], y3=py+dv[1], z3=pz+dv[2];

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

export function buildLODChunkMesh(world, scx, scz) {
  const SUPER = 4, SCALE = 4;
  const COLS = (CHUNK_SIZE * SUPER) / SCALE;
  const SIZE = CHUNK_SIZE * SUPER;

  const positions = [], normals = [], colors = [], indices = [];
  const wx0 = scx * SIZE, wz0 = scz * SIZE;

  const heights = new Float32Array(COLS * COLS);
  const colData = new Uint8Array(COLS * COLS);

  for (let lz = 0; lz < COLS; lz++) {
    for (let lx = 0; lx < COLS; lx++) {
      const wx = wx0 + lx * SCALE + SCALE * 0.5;
      const wz = wz0 + lz * SCALE + SCALE * 0.5;
      heights[lx + lz * COLS] = Math.max(1, Math.min(WORLD_HEIGHT - 1, world.terrainHeight(wx, wz)));
      const biome = world.getBiome(wx, wz);
      let biomeVal = 0;
      if (biome === 'desert') biomeVal = 1;
      else if (biome === 'mountain') biomeVal = 2;
      else if (biome === 'snow') biomeVal = 3;
      else if (biome === 'ice') biomeVal = 4;
      else if (biome === 'swamp') biomeVal = 5;
      else if (biome === 'savanna') biomeVal = 6;
      else if (biome === 'coral_reef') biomeVal = 7;
      else if (biome === 'mushroom') biomeVal = 8;
      else if (biome === 'cherry_grove') biomeVal = 9;
      else if (biome === 'bamboo_forest') biomeVal = 10;
      else if (biome === 'volcanic') biomeVal = 11;
      else if (biome === 'soul_sand_valley') biomeVal = 12;
      else if (biome === 'end_highlands') biomeVal = 13;
      else if (biome === 'nether_wastes') biomeVal = 14;
      else if (biome === 'oasis') biomeVal = 15;
      else if (biome === 'ice_spikes') biomeVal = 16;
      else if (biome === 'taiga') biomeVal = 17;
      else if (biome === 'mesa') biomeVal = 18;
      else if (biome === 'plains') biomeVal = 19;
      else if (biome === 'jungle') biomeVal = 20;
      else if (biome === 'dark_forest') biomeVal = 21;
      colData[lx + lz * COLS] = biomeVal;
    }
  }

  const getColor = (t) => {
    if (t === 1) return BLOCK_COLORS[SAND];
    if (t === 2) return BLOCK_COLORS[STONE];
    if (t === 3) return BLOCK_COLORS[SNOW_BLOCK];
    if (t === 4) return BLOCK_COLORS[ICE];
    if (t === 5) return new THREE.Color(0x6b4c3b);
    if (t === 6) return new THREE.Color(0xcdb38c);
    if (t === 7) return new THREE.Color(0x70c8c8);
    if (t === 8) return new THREE.Color(0x9c8e6e);
    if (t === 9) return new THREE.Color(0xffb7c5);
    if (t === 10) return new THREE.Color(0x5c9e3a);
    if (t === 11) return new THREE.Color(0xd45500);
    if (t === 12) return new THREE.Color(0x6b4c3b);
    if (t === 13) return new THREE.Color(0xe0dba0);
    if (t === 14) return new THREE.Color(0x4c1e1e);
    if (t === 15) return new THREE.Color(0xaacc88);
    if (t === 16) return new THREE.Color(0x8ecfe0);
    if (t === 17) return new THREE.Color(0x6b8e4c);
    if (t === 18) return new THREE.Color(0xd28c5c);
    if (t === 19) return new THREE.Color(0x8bb55c);
    if (t === 20) return new THREE.Color(0x4c8c3a);
    if (t === 21) return new THREE.Color(0x3a5c2a);
    return BLOCK_COLORS[GRASS];
  };

  function addFace(x1,y1,z1, x2,y2,z2, x3,y3,z3, x4,y4,z4, nx,ny,nz, col) {
    const base = positions.length / 3;
    positions.push(x1,y1,z1, x2,y2,z2, x3,y3,z3, x4,y4,z4);
    for (let i=0;i<4;i++){ normals.push(nx,ny,nz); colors.push(col.r,col.g,col.b); }
    indices.push(base, base+1, base+2, base, base+2, base+3);
  }

  for (let lz = 0; lz < COLS; lz++) {
    for (let lx = 0; lx < COLS; lx++) {
      const idx = lx + lz * COLS;
      const h = heights[idx];
      const c = getColor(colData[idx]);
      const x0 = wx0 + lx * SCALE, x1 = x0 + SCALE;
      const z0 = wz0 + lz * SCALE, z1 = z0 + SCALE;
      addFace(x0,h,z1, x1,h,z1, x1,h,z0, x0,h,z0, 0,1,0, c);
    }
  }

  for (let lz = 0; lz < COLS; lz++) {
    for (let lx = 0; lx < COLS; lx++) {
      const idx = lx + lz * COLS;
      const h = heights[idx];
      const xEdge = wx0 + (lx + 1) * SCALE, zEdge = wz0 + (lz + 1) * SCALE;
      const z0 = wz0 + lz * SCALE, x0 = wx0 + lx * SCALE;

      if (lx + 1 < COLS) {
        const hR = heights[(lx+1) + lz * COLS];
        if (h !== hR) {
          const hMin = Math.min(h, hR), hMax = Math.max(h, hR);
          const c = h > hR ? getColor(colData[idx]) : getColor(colData[(lx+1)+lz*COLS]);
          if (h > hR) addFace(xEdge, hMin, z0+SCALE, xEdge, hMin, z0, xEdge, hMax, z0, xEdge, hMax, z0+SCALE, 1,0,0, c);
          else addFace(xEdge, hMin, z0, xEdge, hMin, z0+SCALE, xEdge, hMax, z0+SCALE, xEdge, hMax, z0, -1,0,0, c);
        }
      }
      if (lz + 1 < COLS) {
        const hF = heights[lx + (lz+1) * COLS];
        if (h !== hF) {
          const hMin = Math.min(h, hF), hMax = Math.max(h, hF);
          const c = h > hF ? getColor(colData[idx]) : getColor(colData[lx+(lz+1)*COLS]);
          if (h > hF) addFace(x0, hMin, zEdge, x0+SCALE, hMin, zEdge, x0+SCALE, hMax, zEdge, x0, hMax, zEdge, 0,0,1, c);
          else addFace(x0+SCALE, hMin, zEdge, x0, hMin, zEdge, x0, hMax, zEdge, x0+SCALE, hMax, zEdge, 0,0,-1, c);
        }
      }
    }
  }

  for (let lz = 0; lz < COLS; lz++) {
    const idx = 0 + lz * COLS;
    const h = heights[idx], c = getColor(colData[idx]), z0 = wz0 + lz * SCALE;
    addFace(wx0, 0, z0, wx0, 0, z0+SCALE, wx0, h, z0+SCALE, wx0, h, z0, -1,0,0, c);
  }
  for (let lz = 0; lz < COLS; lz++) {
    const idx = (COLS-1) + lz * COLS;
    const h = heights[idx], c = getColor(colData[idx]), z0 = wz0 + lz * SCALE, xr = wx0 + SIZE;
    addFace(xr, 0, z0+SCALE, xr, 0, z0, xr, h, z0, xr, h, z0+SCALE, 1,0,0, c);
  }
  for (let lx = 0; lx < COLS; lx++) {
    const idx = lx + 0 * COLS;
    const h = heights[idx], c = getColor(colData[idx]), x0 = wx0 + lx * SCALE;
    addFace(x0+SCALE, 0, wz0, x0, 0, wz0, x0, h, wz0, x0+SCALE, h, wz0, 0,0,-1, c);
  }
  for (let lx = 0; lx < COLS; lx++) {
    const idx = lx + (COLS-1) * COLS;
    const h = heights[idx], c = getColor(colData[idx]), x0 = wx0 + lx * SCALE, zf = wz0 + SIZE;
    addFace(x0, 0, zf, x0+SCALE, 0, zf, x0+SCALE, h, zf, x0, h, zf, 0,0,1, c);
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