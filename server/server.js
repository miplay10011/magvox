import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createMagicEngine } from '../magic.js';

process.on('uncaughtException', (err) => console.error('❌ Uncaught Exception:', err));

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' };
const httpServer = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const file = path.join(ROOT, path.normalize(urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

// ---------- Блоки ----------
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5;
const PLANKS = 6, SAND = 7, GRAVEL = 8, COAL_ORE = 9, IRON_ORE = 10;
const ICE = 11, SNOW_BLOCK = 12, CACTUS = 13;
const BRICK = 14, OBSIDIAN = 15, GLOWSTONE = 16, MOSSY_STONE = 17, SANDSTONE = 18;
const NETHERRACK = 19, END_STONE = 20, PURPUR = 21, PRISMARINE = 22, SEA_LANTERN = 23;
const MAGMA = 24, SOUL_SAND = 25, HONEY = 26, SLIME = 27, BAMBOO = 28;
const CHERRY_LOG = 29, CHERRY_LEAVES = 30, MUSHROOM_STEM = 31;
const RED_MUSHROOM = 32, BROWN_MUSHROOM = 33, CORAL = 34, SPONGE = 35;
const MYCELIUM = 36, TERRACOTTA = 37, PACKED_ICE = 38;

// ---------- Никнеймы ----------
const ADJECTIVES = ["Весёлый","Храбрый","Тихий","Быстрый","Умный","Смелый","Добрый","Злой","Магический","Ледяной","Огненный","Тёмный","Светлый","Летающий","Подземный","Древний","Могучий"];
const NOUNS = ["Волшебник","Маг","Чародей","Колдун","Шаман","Друид","Некромант","Иллюзионист","Алхимик","Варлок","Магистр","Архимаг","Мистик","Заклинатель"];
function randomNickname() {
  return `${ADJECTIVES[Math.floor(Math.random()*ADJECTIVES.length)]}${NOUNS[Math.floor(Math.random()*NOUNS.length)]}${Math.floor(Math.random()*1000)}`;
}

// ---------- Шум Перлина ----------
const PERM = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
const p = new Array(512);
for (let i = 0; i < 256; i++) p[i] = p[i+256] = PERM[i];
function fade(t) { return t*t*t*(t*(t*6-15)+10); }
function lerp(t,a,b) { return a+t*(b-a); }
function grad(h,x,y,z) {
  h &= 15;
  const u = h < 8 ? x : y, v = h < 4 ? y : (h===12||h===14 ? x : z);
  return ((h&1)===0 ? u : -u) + ((h&2)===0 ? v : -v);
}
function noise(x,y,z) {
  const xf = Math.floor(x), yf = Math.floor(y), zf = Math.floor(z);
  const X = xf & 255, Y = yf & 255, Z = zf & 255;
  x -= xf; y -= yf; z -= zf;
  const u = fade(x), v = fade(y), w = fade(z);
  const A = p[X]+Y, AA = p[A]+Z, AB = p[A+1]+Z;
  const B = p[X+1]+Y, BA = p[B]+Z, BB = p[B+1]+Z;
  return lerp(w,
    lerp(v, lerp(u, grad(p[AA], x, y, z), grad(p[BA], x-1, y, z)),
            lerp(u, grad(p[AB], x, y-1, z), grad(p[BB], x-1, y-1, z))),
    lerp(v, lerp(u, grad(p[AA+1], x, y, z-1), grad(p[BA+1], x-1, y, z-1)),
            lerp(u, grad(p[AB+1], x, y-1, z-1), grad(p[BB+1], x-1, y-1, z-1))));
}

let seed;
function getBiome(wx, wz) {
  const val = (noise(wx * 0.008 + seed, wz * 0.008 + seed, 300) + 1) / 2;
  const val2 = (noise(wx * 0.02 + seed, wz * 0.02 + seed, 400) + 1) / 2;
  const val3 = (noise(wx * 0.005 + seed, wz * 0.005 + seed, 500) + 1) / 2;
  if (val < 0.05) return 'coral_reef';
  if (val < 0.10) return 'mushroom';
  if (val < 0.15) return 'cherry_grove';
  if (val < 0.20) return 'bamboo_forest';
  if (val < 0.25) return 'volcanic';
  if (val < 0.30) return 'soul_sand_valley';
  if (val < 0.35) return 'end_highlands';
  if (val < 0.40) return 'nether_wastes';
  if (val < 0.45 && val2 > 0.6) return 'desert';
  if (val < 0.48 && val2 > 0.7) return 'oasis';
  if (val < 0.52 && val3 > 0.7) return 'ice_spikes';
  if (val < 0.56) return 'snow';
  if (val < 0.60) return 'ice';
  if (val < 0.64) return 'taiga';
  if (val < 0.68 && val2 < 0.3) return 'swamp';
  if (val < 0.72 && val2 > 0.7) return 'savanna';
  if (val < 0.76 && val3 > 0.6) return 'mesa';
  if (val < 0.80) return 'forest';
  if (val < 0.84) return 'mountain';
  if (val < 0.88) return 'plains';
  if (val < 0.94) return 'jungle';
  return 'dark_forest';
}

function rawTerrainHeight(wx, wz) {
  let h = 24;
  h += noise(wx/80+seed, wz/80+seed, 0)   * 16;
  h += noise(wx/30+seed, wz/30+seed, 100) * 6;
  h += noise(wx/12+seed, wz/12+seed, 200) * 2;
  const biome = getBiome(wx, wz);
  if (biome === 'desert') {
    h = 28 + noise(wx/50+seed, wz/50+seed, 400) * 3;
    h = Math.max(24, Math.min(35, h));
  } else if (biome === 'mountain') {
    h += noise(wx/20+seed, wz/20+seed, 150) * 20;
    h += Math.abs(noise(wx/6+seed, wz/6+seed, 250)) * 12;
    h = Math.max(45, Math.min(63, h));
  } else if (biome === 'ice') {
    h = 26 + noise(wx/40+seed, wz/40+seed, 500) * 4;
    h = Math.max(20, Math.min(30, h));
  } else if (biome === 'snow') {
    h = 28 + noise(wx/35+seed, wz/35+seed, 550) * 5;
    h = Math.max(22, Math.min(35, h));
  } else if (biome === 'swamp') {
    h = 22 + noise(wx/25+seed, wz/25+seed, 600) * 3;
    h = Math.max(18, Math.min(28, h));
  } else if (biome === 'savanna') {
    h = 30 + noise(wx/30+seed, wz/30+seed, 650) * 6;
    h = Math.max(26, Math.min(40, h));
  } else if (biome === 'coral_reef') {
    h = 20 + noise(wx/20+seed, wz/20+seed, 700) * 4;
    h = Math.max(18, Math.min(25, h));
  } else if (biome === 'mushroom') {
    h = 24 + noise(wx/25+seed, wz/25+seed, 750) * 5;
    h = Math.max(20, Math.min(30, h));
  } else if (biome === 'cherry_grove') {
    h = 26 + noise(wx/30+seed, wz/30+seed, 800) * 6;
    h = Math.max(22, Math.min(35, h));
  } else if (biome === 'bamboo_forest') {
    h = 28 + noise(wx/25+seed, wz/25+seed, 850) * 5;
    h = Math.max(24, Math.min(38, h));
  } else if (biome === 'volcanic') {
    h = 40 + Math.abs(noise(wx/15+seed, wz/15+seed, 900)) * 20;
    h = Math.max(50, Math.min(63, h));
  } else if (biome === 'soul_sand_valley') {
    h = 32 + noise(wx/20+seed, wz/20+seed, 950) * 8;
    h = Math.max(30, Math.min(45, h));
  } else if (biome === 'end_highlands') {
    h = 35 + noise(wx/18+seed, wz/18+seed, 1000) * 12;
    h = Math.max(32, Math.min(55, h));
  } else if (biome === 'nether_wastes') {
    h = 30 + noise(wx/22+seed, wz/22+seed, 1050) * 10;
    h = Math.max(28, Math.min(48, h));
  } else if (biome === 'oasis') {
    h = 26 + noise(wx/20+seed, wz/20+seed, 1100) * 3;
    h = Math.max(24, Math.min(32, h));
  } else if (biome === 'ice_spikes') {
    h = 28 + noise(wx/25+seed, wz/25+seed, 1150) * 8;
    h = Math.max(25, Math.min(40, h));
  } else if (biome === 'taiga') {
    h = 28 + noise(wx/25+seed, wz/25+seed, 1200) * 6;
    h = Math.max(24, Math.min(40, h));
  } else if (biome === 'mesa') {
    h = 32 + noise(wx/20+seed, wz/20+seed, 1250) * 10;
    h = Math.max(28, Math.min(55, h));
  } else if (biome === 'plains') {
    h = 24 + noise(wx/40+seed, wz/40+seed, 1300) * 4;
    h = Math.max(20, Math.min(32, h));
  } else if (biome === 'jungle') {
    h = 24 + noise(wx/20+seed, wz/20+seed, 1350) * 8;
    h = Math.max(20, Math.min(45, h));
  } else if (biome === 'dark_forest') {
    h = 26 + noise(wx/25+seed, wz/25+seed, 1400) * 6;
    h = Math.max(22, Math.min(40, h));
  } else {
    h += noise(wx/25+seed, wz/25+seed, 300) * 6;
    h = Math.max(20, Math.min(50, h));
  }
  return Math.max(1, Math.min(63, Math.floor(h)));
}

function terrainHeight(wx, wz) {
  const step = 16;
  const x0 = Math.floor(wx / step) * step;
  const z0 = Math.floor(wz / step) * step;
  const x1 = x0 + step, z1 = z0 + step;
  const h00 = rawTerrainHeight(x0, z0);
  const h10 = rawTerrainHeight(x1, z0);
  const h01 = rawTerrainHeight(x0, z1);
  const h11 = rawTerrainHeight(x1, z1);
  const fx = (wx - x0) / step, fz = (wz - z0) / step;
  const h0 = h00 * (1 - fx) + h10 * fx;
  const h1 = h01 * (1 - fx) + h11 * fx;
  return Math.max(1, Math.min(63, Math.floor(h0 * (1 - fz) + h1 * fz)));
}

const heightCache = new Map();
const biomeCache = new Map();
function getCachedHeight(wx, wz) {
  const k = `${wx},${wz}`;
  let v = heightCache.get(k);
  if (v === undefined) { v = terrainHeight(wx, wz); heightCache.set(k, v); }
  return v;
}
function getCachedBiome(wx, wz) {
  const k = `${wx},${wz}`;
  let v = biomeCache.get(k);
  if (v === undefined) { v = getBiome(wx, wz); biomeCache.set(k, v); }
  return v;
}

function getBlockType(x, y, z) {
  if (y < 0 || y >= 64) return AIR;
  const key = `${x},${y},${z}`;
  if (edits.has(key)) return edits.get(key);
  const h = getCachedHeight(x, z);
  if (y >= h) return AIR;
  if (y === h - 1) {
    const biome = getCachedBiome(x, z);
    if (biome === 'desert') return SAND;
    if (biome === 'oasis') return GRASS;
    if (biome === 'ice' || biome === 'ice_spikes') return ICE;
    if (biome === 'snow') return SNOW_BLOCK;
    if (biome === 'coral_reef') return SAND;
    if (biome === 'mushroom') return MYCELIUM;
    if (biome === 'cherry_grove') return GRASS;
    if (biome === 'bamboo_forest') return GRASS;
    if (biome === 'volcanic') return MAGMA;
    if (biome === 'soul_sand_valley') return SOUL_SAND;
    if (biome === 'end_highlands') return END_STONE;
    if (biome === 'nether_wastes') return NETHERRACK;
    if (biome === 'taiga') return GRASS;
    if (biome === 'mesa') return TERRACOTTA;
    if (biome === 'plains') return GRASS;
    if (biome === 'jungle') return GRASS;
    if (biome === 'dark_forest') return GRASS;
    return GRASS;
  }
  if (y >= h - 4) {
    const biome = getCachedBiome(x, z);
    if (biome === 'snow' || biome === 'ice') return PACKED_ICE;
    return DIRT;
  }
  if (y < 40 && noise(x*0.1, y*0.1, z*0.1) > 0.85) return IRON_ORE;
  if (y < 60 && noise(x*0.12, y*0.12, z*0.12) > 0.7) return COAL_ORE;
  return STONE;
}

// ---------- Генерация деревьев и строений ----------
function generateBigTree(editsMap, cx, cz, groundY) {
  const trunkHeight = 5 + Math.floor(Math.random() * 3);
  const startX = Math.floor(cx), startZ = Math.floor(cz), startY = groundY;
  for (let h = 0; h < trunkHeight; h++) {
    const y = startY + h;
    if (y >= 64) break;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const x = startX + dx, z = startZ + dz;
        if (dx === 0 && dz === 0) editsMap.set(`${x},${y},${z}`, WOOD);
        else if (h < trunkHeight - 1) editsMap.set(`${x},${y},${z}`, WOOD);
      }
    }
  }
  const crownY = startY + trunkHeight - 1, radius = 3;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dz = -radius; dz <= radius; dz++) {
        if (Math.sqrt(dx*dx + dz*dz + dy*dy) <= radius + 0.5) {
          const x = startX + dx, z = startZ + dz, y = crownY + dy;
          if (y >= 0 && y < 64) {
            const cur = getBlockType(x, y, z);
            if (cur === AIR || cur === LEAVES) editsMap.set(`${x},${y},${z}`, LEAVES);
          }
        }
      }
    }
  }
  for (let dy = -1; dy <= 1; dy++) {
    const y = crownY + dy;
    if (y >= 0 && y < 64) editsMap.set(`${startX},${y},${startZ}`, WOOD);
  }
}

function generateHouse(editsMap, cx, cz, groundY) {
  const wood = WOOD, planks = PLANKS;
  const width = 10, height = 10, depth = 10;
  const startX = cx - width/2, startZ = cz - depth/2;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        const wx = startX + x, wz = startZ + z, wy = groundY + y;
        if (wy >= 64) continue;
        if (x === 0 || x === width-1 || z === 0 || z === depth-1 || y === 0 || y === height-1) {
          if (z === 0 && x >= 4 && x <= 5 && y >= 1 && y <= 2) continue;
          editsMap.set(`${wx},${wy},${wz}`, (y === 0) ? planks : wood);
        }
      }
    }
  }
}

function generatePyramid(editsMap, cx, cz, groundY) {
  const stone = SANDSTONE;
  const size = 9;
  const startX = cx - Math.floor(size/2), startZ = cz - Math.floor(size/2);
  for (let y = 0; y < size; y++) {
    const s = size - y;
    for (let x = 0; x < s; x++) {
      for (let z = 0; z < s; z++) {
        const wx = startX + x + y/2, wz = startZ + z + y/2, wy = groundY + y;
        if (wy >= 64) continue;
        if (x === 0 || x === s-1 || z === 0 || z === s-1 || y === size-1) {
          editsMap.set(`${wx},${wy},${wz}`, stone);
        }
      }
    }
  }
}

function generateIgloo(editsMap, cx, cz, groundY) {
  const ice = ICE, snow = SNOW_BLOCK;
  const radius = 4;
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist > radius) continue;
      const wx = cx + dx, wz = cz + dz;
      const height = Math.floor(radius - dist);
      for (let y = 0; y <= height; y++) {
        const wy = groundY + y;
        if (wy >= 64) continue;
        editsMap.set(`${wx},${wy},${wz}`, y === height ? snow : ice);
      }
    }
  }
  editsMap.set(`${cx},${groundY+1},${cz - radius}`, AIR);
}

function generateJungleTemple(editsMap, cx, cz, groundY) {
  const stone = MOSSY_STONE;
  const width = 8, height = 6, depth = 8;
  const startX = cx - width/2, startZ = cz - depth/2;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        const wx = startX + x, wz = startZ + z, wy = groundY + y;
        if (wy >= 64) continue;
        if (x === 0 || x === width-1 || z === 0 || z === depth-1 || y === 0 || y === height-1) {
          if (z === 0 && x >= 3 && x <= 4 && y >= 1 && y <= 2) continue;
          editsMap.set(`${wx},${wy},${wz}`, stone);
        }
      }
    }
  }
  for (let x = 0; x <= width-1; x+=width-1) {
    for (let z = 0; z <= depth-1; z+=depth-1) {
      for (let y = 0; y < height; y++) {
        editsMap.set(`${startX+x},${groundY+y},${startZ+z}`, stone);
      }
    }
  }
}

function generateWitchHut(editsMap, cx, cz, groundY) {
  const wood = WOOD, planks = PLANKS;
  const width = 7, height = 5, depth = 7;
  const startX = cx - width/2, startZ = cz - depth/2;
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      const wy = groundY;
      if (wy >= 64) continue;
      if (Math.abs(x - width/2) < 2 && Math.abs(z - depth/2) < 2) {
        editsMap.set(`${startX+x},${wy},${startZ+z}`, planks);
      } else {
        editsMap.set(`${startX+x},${wy-1},${startZ+z}`, WOOD);
      }
      if (x === 0 || x === width-1 || z === 0 || z === depth-1) {
        for (let y = 1; y < height; y++) {
          const wy2 = groundY + y;
          if (wy2 >= 64) continue;
          editsMap.set(`${startX+x},${wy2},${startZ+z}`, wood);
        }
      }
    }
  }
}

function generateShipwreck(editsMap, cx, cz, groundY) {
  const wood = WOOD, planks = PLANKS;
  const length = 10, width = 4, height = 3;
  const startX = cx - length/2, startZ = cz - width/2;
  for (let l = 0; l < length; l++) {
    for (let w = 0; w < width; w++) {
      for (let h = 0; h < height; h++) {
        const wx = startX + l, wz = startZ + w, wy = groundY + h;
        if (wy >= 64) continue;
        if (h === 0) editsMap.set(`${wx},${wy},${wz}`, planks);
        else if (l === 0 || l === length-1 || w === 0 || w === width-1) {
          editsMap.set(`${wx},${wy},${wz}`, wood);
        }
      }
    }
  }
}

function generateGiantMushroom(editsMap, cx, cz, groundY) {
  const stem = MUSHROOM_STEM, cap = RED_MUSHROOM;
  const height = 6, capRadius = 4;
  for (let y = 0; y < height; y++) {
    editsMap.set(`${cx},${groundY + y},${cz}`, stem);
  }
  for (let dx = -capRadius; dx <= capRadius; dx++) {
    for (let dz = -capRadius; dz <= capRadius; dz++) {
      const dist = Math.sqrt(dx*dx + dz*dz);
      if (dist <= capRadius) {
        editsMap.set(`${cx+dx},${groundY+height-1},${cz+dz}`, cap);
      }
    }
  }
}

function generateObsidianTower(editsMap, cx, cz, groundY) {
  const obsidian = OBSIDIAN;
  const height = 12, width = 3;
  for (let y = 0; y < height; y++) {
    for (let x = -width; x <= width; x++) {
      for (let z = -width; z <= width; z++) {
        if (Math.abs(x) === width || Math.abs(z) === width || y === 0 || y === height-1) {
          editsMap.set(`${cx+x},${groundY+y},${cz+z}`, obsidian);
        }
      }
    }
  }
}

function generateEndCity(editsMap, cx, cz, groundY) {
  const endStone = END_STONE, purpur = PURPUR;
  const height = 8;
  for (let y = 0; y < height; y++) {
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        if (Math.abs(x) === 2 && Math.abs(z) === 2) continue;
        editsMap.set(`${cx+x},${groundY+y},${cz+z}`, (y % 2 === 0) ? purpur : endStone);
      }
    }
  }
}

function generateDungeon(editsMap, cx, cz, groundY) {
  const stone = STONE, moss = MOSSY_STONE;
  for (let y = 0; y < 3; y++) {
    for (let x = -1; x <= 1; x++) {
      editsMap.set(`${cx+x},${groundY + y + 1},${cz}`, (y === 1 && x === 0) ? AIR : stone);
    }
  }
  const roomY = groundY - 3;
  for (let x = -3; x <= 3; x++) {
    for (let z = -3; z <= 3; z++) {
      for (let y = -2; y <= 2; y++) {
        const wy = roomY + y;
        if (wy < 0) continue;
        if (Math.abs(x) === 3 || Math.abs(z) === 3 || y === -2 || y === 2) {
          editsMap.set(`${cx+x},${wy},${cz+z}`, moss);
        } else {
          editsMap.set(`${cx+x},${wy},${cz+z}`, AIR);
        }
      }
    }
  }
}

// ---------- Инициализация мира и правок ----------
seed = Math.floor(Math.random() * 10000);
const edits = new Map();
const players = new Map();
let nextId = 1;

for (let cx = -20; cx <= 20; cx++) {
  for (let cz = -20; cz <= 20; cz++) {
    const centerX = cx * 16 + 8, centerZ = cz * 16 + 8;
    const biome = getCachedBiome(centerX, centerZ);
    const groundY = getCachedHeight(centerX, centerZ);
    // Деревья (шанс 10%)
    if ((biome === 'forest' || biome === 'swamp' || biome === 'savanna' || biome === 'taiga' || biome === 'jungle' || biome === 'dark_forest' || biome === 'cherry_grove') && Math.random() < 0.1 && groundY < 55 && groundY > 2) {
      generateBigTree(edits, centerX, centerZ, groundY);
    }
    // Строения (шанс 3%)
    if (Math.random() < 0.03) {
      if (biome === 'desert' && Math.random() < 0.5) generatePyramid(edits, centerX, centerZ, groundY);
      else if (biome === 'mountain' && Math.random() < 0.4) generateDungeon(edits, centerX, centerZ, groundY);
      else if (biome === 'snow' && Math.random() < 0.4) generateIgloo(edits, centerX, centerZ, groundY);
      else if (biome === 'jungle' && Math.random() < 0.4) generateJungleTemple(edits, centerX, centerZ, groundY);
      else if (biome === 'swamp' && Math.random() < 0.4) generateWitchHut(edits, centerX, centerZ, groundY);
      else if (biome === 'coral_reef') generateShipwreck(edits, centerX, centerZ, groundY);
      else if (biome === 'mushroom') generateGiantMushroom(edits, centerX, centerZ, groundY);
      else if (biome === 'volcanic') generateObsidianTower(edits, centerX, centerZ, groundY);
      else if (biome === 'end_highlands') generateEndCity(edits, centerX, centerZ, groundY);
      else generateHouse(edits, centerX, centerZ, groundY);
    }
    // Кактусы в пустыне
    if (biome === 'desert' && Math.random() < 0.03) {
      const cactusHeight = 1 + Math.floor(Math.random() * 3);
      for (let h = 0; h < cactusHeight; h++) {
        edits.set(`${centerX},${groundY + h},${centerZ}`, CACTUS);
      }
    }
  }
}

// ---------- WebSocket сервер и всё остальное ----------
const wss = new WebSocketServer({ server: httpServer });
function send(ws, type, data) { if (ws.readyState === 1) ws.send(JSON.stringify({type,...data})); }
function broadcast(type, data, exceptId = null) {
  const msg = JSON.stringify({type,...data});
  for (const [id, q] of players) if (id !== exceptId && q.ws.readyState === 1) q.ws.send(msg);
}
function syncEffects(q) { send(q.ws,'effects',{list:[...q.effects].map(([e,v])=>({e,until:v.until,power:v.power}))}); }

function applyDamage(targetId, dmg, src = {}) {
  const target = players.get(targetId);
  if (!target) return;
  const attackerId = src.attackerId;
  const attacker = attackerId ? players.get(attackerId) : null;
  if (src.weapon?.includes('огн') && target.effects.has('fire_resist')) dmg *= (1 - target.effects.get('fire_resist').power);
  if (target.effects.has('vulnerability')) dmg *= 1.5;
  if (target.effects.has('weakness')) dmg *= 0.5;
  const ward = target.effects.get('ward');
  if (ward && dmg > 0) {
    const abs = Math.min(ward.power, dmg);
    ward.power -= abs; dmg -= abs;
    if (ward.power <= 0) target.effects.delete('ward');
    syncEffects(target);
  }
  const stoneskin = target.effects.get('stoneskin');
  const bonus = stoneskin ? stoneskin.power : 0;
  dmg *= 1 - 0.04 * (target.armor + bonus);
  if (dmg <= 0 && !(src.kb > 0)) return;
  if (target.effects.has('ice_skin') && attackerId && attackerId !== targetId && attacker) {
    if (!attacker.effects.has('freeze')) {
      attacker.effects.set('freeze', { until: Date.now() + (target.effects.get('ice_skin').power || 2) * 1000, power: 1 });
      syncEffects(attacker);
    }
  }
  if (target.chainLink && players.has(target.chainLink)) {
    const linked = players.get(target.chainLink);
    if (linked && linked !== target && linked.hp > 0 && dmg > 0) {
      const ldmg = dmg * (target.chainTransfer || 0.5);
      if (ldmg > 0) applyDamage(target.chainLink, ldmg, { ...src, weapon: 'цепочки послушания', kb: 0 });
    }
  }
  if (target.sphereReflect && target.sphereReflect > 0 && attackerId && attackerId !== targetId && attacker && attacker.hp > 0) {
    const refl = dmg * target.sphereReflect;
    if (refl > 0) applyDamage(attackerId, refl, { weapon: 'отражённый урон', attackerId: targetId });
  }
  const wasAlive = target.hp > 0;
  target.hp -= Math.max(0, dmg);
  if (target.hp <= 4 && !target.phoenixUsed && target.effects.has('phoenix')) {
    target.phoenixUsed = true; target.hp = 8;
    broadcast('systemMessage', { message: `${target.nickname} возродился как Феникс!` });
    broadcast('hp', { id: targetId, hp: target.hp });
    for (const [id, p] of players) {
      if (id === targetId) continue;
      if (Math.hypot(p.x - target.x, p.z - target.z) < 8) {
        p.effects.set('blind', { until: Date.now() + 5000, power: 1 });
        p.effects.set('fear', { until: Date.now() + 5000, power: 1 });
        syncEffects(p);
      }
    }
    return;
  }
  if (target.hp <= 0 && wasAlive) {
    target.hp = 50; target.effects.clear(); syncEffects(target);
    broadcast('respawn', { id: targetId });
    broadcast('hp', { id: targetId, hp: 50 });
    target.phoenixUsed = false;
    if (attackerId && attackerId !== targetId && attacker) {
      const msg = `${attacker.nickname} убил ${target.nickname} с помощью ${src.weapon || 'неизвестного оружия'}`;
      broadcast('systemMessage', { message: msg }); console.log(msg);
    } else {
      broadcast('systemMessage', { message: `${target.nickname} погиб` });
    }
  } else {
    if (dmg > 0) broadcast('hp', { id: targetId, hp: target.hp });
    send(target.ws, 'damaged', { ax: src.ax ?? target.x, az: src.az ?? target.z, hp: target.hp, kb: src.kb ?? 6 });
  }
}

// Зоны, тотемы, шаги
const activeZones = new Map();
function addZone(x, z, radius, effect, ownerId, duration) {
  const id = Math.random();
  activeZones.set(id, { x, z, radius, effect, owner: ownerId, until: Date.now() + duration * 1000 });
  setTimeout(() => activeZones.delete(id), duration * 1000);
  broadcast('zoneSpawn', { id, x, z, radius, effect, duration });
}

const timeSlowZones = new Map();
function addTimeSlowZone(casterId, x, z, radius, duration) {
  const id = Math.random();
  timeSlowZones.set(id, { x, z, radius, endTime: Date.now() + duration * 1000, casterId });
  broadcast('timeSlowZone', { zoneId: id, x, z, radius, duration });
  setTimeout(() => timeSlowZones.delete(id), duration * 1000);
}

const activeTotems = new Map();
function addTotem(casterId, x, z, radius, duration) {
  const id = Math.random();
  let lastTick = Date.now();
  const interval = setInterval(() => {
    const now = Date.now();
    if (now - lastTick < 3000) return;
    lastTick = now;
    const inRange = [...players.values()].filter(p => p.id !== casterId && Math.hypot(p.x - x, p.z - z) < radius);
    if (inRange.length) {
      const t = inRange[Math.floor(Math.random() * inRange.length)];
      t.effects.set('speed', { until: now + 5000, power: 1.5 });
      syncEffects(t);
      broadcast('totemCharge', { targetId: t.id, casterId });
      broadcast('totemPower', { targetId: t.id, power: 6 });
    }
  }, 3000);
  activeTotems.set(id, { x, z, radius, endTime: Date.now() + duration * 1000, casterId, interval });
  broadcast('totemSpawn', { id, x, z, radius, duration });
  setTimeout(() => {
    const t = activeTotems.get(id);
    if (t) { clearInterval(t.interval); activeTotems.delete(id); broadcast('totemEnd', { id }); }
  }, duration * 1000);
}

function performShadowStep(casterId) {
  const caster = players.get(casterId);
  if (!caster) return;
  let nearest = null, minDist = Infinity;
  for (const [pid, p] of players) {
    if (pid === casterId) continue;
    const dist = Math.hypot(caster.x - p.x, caster.z - p.z);
    if (dist < minDist && dist < 10) { minDist = dist; nearest = p; }
  }
  if (nearest) {
    const dirX = -Math.sin(nearest.yaw), dirZ = -Math.cos(nearest.yaw);
    const teleX = nearest.x + dirX * 1.5, teleZ = nearest.z + dirZ * 1.5;
    const teleY = getCachedHeight(teleX, teleZ) + 1;
    const oldX = caster.x, oldZ = caster.z;
    caster.x = teleX; caster.y = teleY; caster.z = teleZ;
    broadcast('teleport', { id: casterId, x: caster.x, y: caster.y, z: caster.z });
    broadcast('shadowStepFx', { x0: oldX, z0: oldZ, x1: caster.x, z1: caster.z });
    broadcast('systemMessage', { message: `${caster.nickname} использовал Теневой шаг` });
  } else {
    send(caster.ws, 'systemMessage', { message: 'Нет цели для теневого шага' });
  }
}

// Пакетная отправка блоков
let pendingBlocks = [];
let pendingTimer = null;
function queueBlockUpdate(x, y, z, t) {
  edits.set(`${x},${y},${z}`, t);
  pendingBlocks.push({ x, y, z, t });
  if (!pendingTimer) pendingTimer = setTimeout(flushBlockBroadcasts, 0);
}
function flushBlockBroadcasts() {
  const blocks = pendingBlocks;
  pendingBlocks = [];
  pendingTimer = null;
  if (blocks.length === 1) broadcast('blockUpdate', blocks[0]);
  else if (blocks.length > 1) broadcast('blocksUpdate', { blocks });
}

// Магический контекст
const magicCtx = {
  getBlock: getBlockType,
  setBlock: queueBlockUpdate,
  terrainHeight: getCachedHeight,
  getPlayers: () => [...players].map(([id, q]) => [id, { x: q.x, y: q.y, z: q.z }]),
  applyDamage,
  addEffect(id, type, dur, power) {
    const q = players.get(id); if (!q) return;
    let data;
    if (power && typeof power === 'object') data = { ...power, until: Date.now() + dur * 1000 };
    else data = { power: power, until: Date.now() + dur * 1000 };
    if (type === 'regen') data.lastTick = Date.now();
    q.effects.set(type, data);
    syncEffects(q);
  },
  healPlayer(id, amount) {
    const q = players.get(id); if (!q || q.effects.has('curse')) return;
    q.hp = Math.min(50, q.hp + amount);
    broadcast('hp', { id, hp: q.hp });
  },
  clearDebuffs(id) {
    const q = players.get(id); if (!q) return;
    for (const b of ['burning','slow','freeze','curse','blind','weakness','vulnerability','disorient','disarm','shadow_shackles']) q.effects.delete(b);
    syncEffects(q);
  },
  getMana: (id) => players.get(id)?.mana ?? 0,
  spendMana(id, cost) {
    const q = players.get(id); if (!q) return;
    q.mana -= cost;
    send(q.ws, 'mana', { mana: Math.floor(q.mana) });
  },
  teleportPlayer(id, x, y, z) {
    const q = players.get(id); if (!q) return;
    q.x = x; q.y = y; q.z = z;
    broadcast('teleport', { id, x: q.x, y: q.y, z: q.z });
  },
  emit(type, data) { broadcast(type, data); },
  addZone, addTotem, addTimeSlowZone,
  chainPlayers(casterId, targetId, transfer = 0.5) {
    const caster = players.get(casterId), target = players.get(targetId);
    if (!caster || !target) return false;
    if (caster.chainLink) delete players.get(caster.chainLink)?.chainLink;
    if (target.chainLink) delete players.get(target.chainLink)?.chainLink;
    caster.chainLink = targetId; target.chainLink = casterId;
    caster.chainTransfer = transfer; target.chainTransfer = transfer;
    broadcast('chainLink', { id1: casterId, id2: targetId });
    return true;
  },
  swapPositions(id1, id2) {
    const p1 = players.get(id1), p2 = players.get(id2);
    if (!p1 || !p2) return;
    [p1.x, p2.x] = [p2.x, p1.x]; [p1.y, p2.y] = [p2.y, p1.y]; [p1.z, p2.z] = [p2.z, p1.z];
    broadcast('teleport', { id: id1, x: p1.x, y: p1.y, z: p1.z });
    broadcast('teleport', { id: id2, x: p2.x, y: p2.y, z: p2.z });
    broadcast('swapFx', { id1, id2 });
  },
  createProtectionSphere(casterId, x, y, z, duration) {
    const caster = players.get(casterId); if (!caster) return;
    caster.sphereEnd = Date.now() + duration * 1000; caster.sphereReflect = 0.5;
    broadcast('sphereSpawn', { casterId, x, y, z, radius: 3, duration });
    const interval = setInterval(() => {
      if (!caster || Date.now() > caster.sphereEnd) {
        clearInterval(interval); if (caster) caster.sphereReflect = null;
        broadcast('sphereEnd', { casterId }); return;
      }
      for (const [id, p] of players) {
        if (Math.hypot(p.x - x, p.z - z) < 3 && p.y > y - 1 && p.y < y + 2) {
          p.hp = Math.min(50, p.hp + 2); broadcast('hp', { id, hp: p.hp });
        }
      }
    }, 1000);
    setTimeout(() => { clearInterval(interval); if (caster) caster.sphereReflect = null; broadcast('sphereEnd', { casterId }); }, duration * 1000);
  },
  summonAsteroid(casterId, x, z, yaw) {
    const impactX = x + Math.sin(yaw) * 3, impactZ = z + Math.cos(yaw) * 3;
    broadcast('asteroidStart', { casterId, x: impactX, z: impactZ, startY: 60 });
    setTimeout(() => {
      const radius = 5, dmg = 18;
      const explode = (xx, yy, zz, rad, dmg2, owner) => {
        const rr = rad * 1.6;
        for (const [id, p] of players) {
          if (id === owner) continue;
          const d2 = (p.x - xx) ** 2 + (p.y + 0.9 - yy) ** 2 + (p.z - zz) ** 2;
          if (d2 < rr * rr) {
            const ad = dmg2 * (1 - Math.sqrt(d2) / rr);
            applyDamage(id, ad, { ax: xx, az: zz, kb: 6 + rad, attackerId: owner, weapon: 'астероида' });
          }
        }
        for (let dx = -rad; dx <= rad; dx++) {
          for (let dz = -rad; dz <= rad; dz++) {
            if (Math.hypot(dx, dz) < rad) {
              const bx = Math.floor(impactX + dx), bz = Math.floor(impactZ + dz);
              const yb = getCachedHeight(bx, bz);
              for (let h = 0; h < Math.max(1, rad - Math.floor(Math.hypot(dx, dz))); h++) {
                queueBlockUpdate(bx, yb + h, bz, STONE);
              }
            }
          }
        }
        flushBlockBroadcasts();
        broadcast('asteroidImpact', { x: impactX, z: impactZ, radius: rad });
      };
      explode(impactX, 0, impactZ, radius, dmg, casterId);
    }, 1500);
  },
  stomp(casterId, x, z, radius) {
    broadcast('stompFx', { x, z, radius });
    for (const [id, p] of players) {
      if (id === casterId) continue;
      if (Math.hypot(p.x - x, p.z - z) < radius) {
        p.y += 3; broadcast('teleport', { id, x: p.x, y: p.y, z: p.z });
        applyDamage(id, 8, { ax: x, az: z, kb: 12, attackerId: casterId, weapon: 'топота' });
        p.effects.set('disarm', { until: Date.now() + 5000, power: 1 });
        syncEffects(p);
      }
    }
  },
  blackVortex(casterId, x, z, duration) {
    broadcast('vortexSpawn', { vortexId: Math.random(), x, z, radius: 4, duration });
    const end = Date.now() + duration * 1000;
    const interval = setInterval(() => {
      if (Date.now() > end) { clearInterval(interval); broadcast('vortexEnd', {}); return; }
      for (const [id, p] of players) {
        if (id !== casterId && Math.hypot(p.x - x, p.z - z) < 6) {
          applyDamage(id, 6, { ax: x, az: z, kb: 5, attackerId: casterId, weapon: 'чёрного вихря' });
        }
      }
    }, 1000);
  },
  lightCage(casterId, targetId) {
    broadcast('cageSpawn', { casterId, targetId });
    const end = Date.now() + 6000;
    const interval = setInterval(() => {
      if (Date.now() > end) { clearInterval(interval); broadcast('cageEnd', { targetId }); return; }
      applyDamage(targetId, 4, { ax: 0, az: 0, kb: 0, attackerId: casterId, weapon: 'световой клетки' });
    }, 1000);
  },
  shadowShackles(casterId, targetId) {
    const target = players.get(targetId);
    if (target) { target.effects.set('shadow_shackles', { until: Date.now() + 6000, power: 1 }); syncEffects(target); broadcast('shacklesFx', { targetId }); }
  },
  castProjectiles: () => {},
};

const magic = createMagicEngine(magicCtx);

// Основной тик сервера
const TICK = 50;
let lastManaSync = 0;
setInterval(() => {
  const now = Date.now(), dt = TICK / 1000;
  for (const [id, q] of players) {
    let changed = false;
    for (const [e, v] of q.effects) {
      if (now > v.until) { q.effects.delete(e); changed = true; }
    }
    const regen = q.effects.get('regen');
    if (regen && now >= (regen.lastTick || 0) + 1000) {
      regen.lastTick = now;
      if (!q.effects.has('curse')) {
        q.hp = Math.min(50, q.hp + regen.power);
        broadcast('hp', { id, hp: q.hp });
      }
    }
    const aura = q.effects.get('fire_aura');
    if (aura) {
      if (!q.lastAuraTick) q.lastAuraTick = 0;
      if (now - q.lastAuraTick >= 1000) {
        q.lastAuraTick = now;
        const rad = aura.radius || 3, dmg = aura.power;
        for (const [pid, p] of players) {
          if (pid === id) continue;
          if (Math.hypot(q.x - p.x, q.z - p.z) < rad) {
            applyDamage(pid, dmg, { attackerId: id, weapon: 'огненной ауры', kb: 0 });
            if (!p.effects.has('burning')) { p.effects.set('burning', { until: now + 3000, power: 1 }); syncEffects(p); }
          }
        }
      }
    }
    const burn = q.effects.get('burning');
    if (burn) {
      q.burnAcc = (q.burnAcc || 0) + dt;
      if (q.burnAcc >= 1) { q.burnAcc -= 1; applyDamage(id, burn.power, { kb: 0 }); }
    }

    // Урон от блоков (кактус, магма)
    const bx = Math.floor(q.x), by = Math.floor(q.y), bz = Math.floor(q.z);
    const blockUnder = getBlockType(bx, by, bz);
    if (blockUnder === CACTUS || blockUnder === MAGMA) {
      if (!q.cactusCooldown || now - q.cactusCooldown > 500) {
        q.cactusCooldown = now;
        applyDamage(id, blockUnder === MAGMA ? 2 : 1, { ax: q.x, az: q.z, kb: 0, weapon: blockUnder === MAGMA ? 'магмы' : 'кактуса' });
      }
    }

    if (changed) syncEffects(q);
    q.mana = Math.min(20, q.mana + dt);
  }

  // Зоны
  for (const [zoneId, zone] of activeZones) {
    if (now > zone.until) { activeZones.delete(zoneId); broadcast('zoneEnd', { id: zoneId }); continue; }
    if (zone.effect === 'levitate_circle') {
      for (const [pid, p] of players) {
        if (Math.hypot(p.x - zone.x, p.z - zone.z) < zone.radius && !p.effects.has('levitate')) {
          p.effects.set('levitate', { until: now + 500, power: 1 });
          syncEffects(p);
        }
      }
    }
  }
  for (const [zoneId, zone] of timeSlowZones) {
    if (now > zone.endTime) { timeSlowZones.delete(zoneId); continue; }
    for (const [pid, p] of players) {
      if (pid === zone.casterId) continue;
      if (Math.hypot(p.x - zone.x, p.z - zone.z) < zone.radius) {
        if (!p.effects.has('time_slow')) { p.effects.set('time_slow', { until: now + 500, power: 0.5 }); syncEffects(p); }
      }
    }
  }

  if (now - lastManaSync > 1000) {
    lastManaSync = now;
    for (const q of players.values()) send(q.ws, 'mana', { mana: Math.floor(q.mana) });
  }
  magic.tick(dt);
}, TICK);

// WebSocket соединения
wss.on('connection', (ws) => {
  const id = nextId++;
  const nickname = randomNickname();
  players.set(id, {
    id, ws, nickname,
    x: 0.5, y: 80, z: 0.5, yaw: 0,
    hp: 50, armor: 0, mana: 20, lastAttack: 0,
    effects: new Map(), phoenixUsed: false
  });
  console.log(`+ ${nickname} (id ${id}) · всего: ${players.size}`);

  send(ws, 'init', {
    id, nickname, seed,
    edits: [...edits],
    snapshot: magic.getSnapshot(),
    players: [...players].filter(([pid]) => pid !== id).map(([pid, q]) => ({
      id: pid, nickname: q.nickname, x: q.x, y: q.y, z: q.z, yaw: q.yaw
    })),
    zones: [...activeZones].map(([zid, z]) => ({ id: zid, x: z.x, z: z.z, radius: z.radius, effect: z.effect })),
    timeSlowZones: [...timeSlowZones].map(([zid, z]) => ({ id: zid, x: z.x, z: z.z, radius: z.radius, duration: (z.endTime - Date.now()) / 1000 })),
  });
  broadcast('join', { id, nickname }, id);

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const q = players.get(id); if (!q) return;
    if (msg.type === 'move') {
      q.x = msg.x; q.y = msg.y; q.z = msg.z; q.yaw = msg.yaw;
      broadcast('move', { id, x: q.x, y: q.y, z: q.z, yaw: q.yaw }, id);
    } else if (msg.type === 'setBlock') {
      edits.set(`${msg.x},${msg.y},${msg.z}`, msg.t);
      broadcast('blockUpdate', { x: msg.x, y: msg.y, z: msg.z, t: msg.t }, id);
    } else if (msg.type === 'attack') {
      const t = players.get(msg.target), now = Date.now();
      if (!t || now - q.lastAttack < 400) return;
      if ((q.x - t.x) ** 2 + (q.y - t.y) ** 2 + (q.z - t.z) ** 2 > 36) return;
      q.lastAttack = now;
      if (q.effects.has('chain_lightning') && Math.random() < (q.effects.get('chain_lightning').power || 0.2)) {
        applyDamage(msg.target, 6, { ax: q.x, az: q.z, kb: 5, attackerId: id, weapon: 'разряда' });
        const cands = [...players.values()].filter(p => p.id !== id && p.id !== msg.target && Math.hypot(p.x - t.x, p.z - t.z) < 5);
        if (cands.length) {
          const next = cands[0];
          applyDamage(next.id, 4, { ax: q.x, az: q.z, kb: 3, attackerId: id, weapon: 'разряда (перескок)' });
          broadcast('lightningEffect', { from: msg.target, to: next.id });
        } else broadcast('lightningEffect', { from: id, to: msg.target });
      }
      applyDamage(msg.target, 4, { ax: q.x, az: q.z, kb: 8, attackerId: id, weapon: 'меча' });
    } else if (msg.type === 'cast') {
      magic.cast(id, msg.elements, msg.dir, { x: q.x, y: q.y + 1.62, z: q.z }, q.yaw, msg.hand || 'left');
    } else if (msg.type === 'chat') {
      broadcast('chat', { senderId: id, senderNick: q.nickname, message: msg.message }, id);
    } else if (msg.type === 'shadow_step') {
      performShadowStep(id);
    } else if (msg.type === 'swap_positions') {
      const target = players.get(msg.target);
      if (target && Math.hypot(q.x - target.x, q.z - target.z) < 10) magicCtx.swapPositions(id, msg.target);
    }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast('leave', { id });
    console.log(`- ${nickname} (id ${id}) · всего: ${players.size}`);
  });
});

const PORT = process.env.PORT || 8081;
httpServer.listen(PORT, () => console.log(`Игра: http://localhost:${PORT} · сид: ${seed}`));