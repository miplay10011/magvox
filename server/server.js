import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { createMagicEngine } from './magic.js';

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

// ==================== БЛОКИ ====================
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5;
const PLANKS = 6, SAND = 7, GRAVEL = 8, COAL_ORE = 9, IRON_ORE = 10;
const ICE = 11, SNOW_BLOCK = 12, CACTUS = 13;
const BRICK = 14, OBSIDIAN = 15, GLOWSTONE = 16, MOSSY_STONE = 17, SANDSTONE = 18;
const NETHERRACK = 19, END_STONE = 20, PURPUR = 21, PRISMARINE = 22, SEA_LANTERN = 23;
const MAGMA = 24, SOUL_SAND = 25, HONEY = 26, SLIME = 27, BAMBOO = 28;
const CHERRY_LOG = 29, CHERRY_LEAVES = 30, MUSHROOM_STEM = 31;
const RED_MUSHROOM = 32, BROWN_MUSHROOM = 33, CORAL = 34, SPONGE = 35;
const MYCELIUM = 36, TERRACOTTA = 37, PACKED_ICE = 38;
const WORLD_HEIGHT = 128;

// ==================== НИКНЕЙМЫ ====================
const ADJECTIVES = ["Весёлый","Храбрый","Тихий","Быстрый","Умный","Смелый","Добрый","Злой","Магический","Ледяной","Огненный","Тёмный","Светлый","Летающий","Подземный","Древний","Могучий"];
const NOUNS = ["Волшебник","Маг","Чародей","Колдун","Шаман","Друид","Некромант","Иллюзионист","Алхимик","Варлок","Магистр","Архимаг","Мистик","Заклинатель"];
function randomNickname() {
  return `${ADJECTIVES[Math.floor(Math.random()*ADJECTIVES.length)]}${NOUNS[Math.floor(Math.random()*NOUNS.length)]}${Math.floor(Math.random()*1000)}`;
}

// ==================== ШУМ ПЕРЛИНА ====================
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
  const val = (noise(wx * 0.003 + seed, wz * 0.003 + seed, 300) + 1) / 2;
  const val2 = (noise(wx * 0.008 + seed, wz * 0.008 + seed, 400) + 1) / 2;
  const val3 = (noise(wx * 0.002 + seed, wz * 0.002 + seed, 500) + 1) / 2;
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
  if (val < 0.70) return 'plains';
  if (val < 0.80) return 'jungle';
  return 'dark_forest';
}

function terrainHeight(wx, wz) {
  let h = 24;
  h += noise(wx/60+seed, wz/60+seed, 0)   * 20;
  h += noise(wx/25+seed, wz/25+seed, 100) * 8;
  h += noise(wx/10+seed, wz/10+seed, 200) * 3;
  const biome = getBiome(wx, wz);
  if (biome === 'desert') { h = 28 + noise(wx/40+seed, wz/40+seed, 400) * 4; h = Math.max(24, Math.min(35, h)); }
  else if (biome === 'mountain') { h += noise(wx/15+seed, wz/15+seed, 150) * 25; h += Math.abs(noise(wx/5+seed, wz/5+seed, 250)) * 15; h = Math.max(50, Math.min(WORLD_HEIGHT - 10, h)); }
  else if (biome === 'ice') { h = 25 + noise(wx/35+seed, wz/35+seed, 500) * 5; h = Math.max(20, Math.min(32, h)); }
  else if (biome === 'snow') { h = 27 + noise(wx/30+seed, wz/30+seed, 550) * 6; h = Math.max(22, Math.min(38, h)); }
  else if (biome === 'swamp') { h = 21 + noise(wx/20+seed, wz/20+seed, 600) * 4; h = Math.max(18, Math.min(28, h)); }
  else if (biome === 'savanna') { h = 29 + noise(wx/25+seed, wz/25+seed, 650) * 7; h = Math.max(26, Math.min(42, h)); }
  else if (biome === 'coral_reef') { h = 18 + noise(wx/18+seed, wz/18+seed, 700) * 5; h = Math.max(15, Math.min(24, h)); }
  else if (biome === 'mushroom') { h = 23 + noise(wx/22+seed, wz/22+seed, 750) * 6; h = Math.max(20, Math.min(32, h)); }
  else if (biome === 'cherry_grove') { h = 26 + noise(wx/28+seed, wz/28+seed, 800) * 7; h = Math.max(22, Math.min(38, h)); }
  else if (biome === 'bamboo_forest') { h = 27 + noise(wx/24+seed, wz/24+seed, 850) * 6; h = Math.max(24, Math.min(40, h)); }
  else if (biome === 'volcanic') { h = 45 + Math.abs(noise(wx/12+seed, wz/12+seed, 900)) * 25; h = Math.max(55, Math.min(WORLD_HEIGHT - 8, h)); }
  else if (biome === 'soul_sand_valley') { h = 32 + noise(wx/18+seed, wz/18+seed, 950) * 10; h = Math.max(30, Math.min(48, h)); }
  else if (biome === 'end_highlands') { h = 38 + noise(wx/16+seed, wz/16+seed, 1000) * 15; h = Math.max(35, Math.min(60, h)); }
  else if (biome === 'nether_wastes') { h = 35 + noise(wx/20+seed, wz/20+seed, 1050) * 12; h = Math.max(32, Math.min(55, h)); }
  else if (biome === 'oasis') { h = 26 + noise(wx/22+seed, wz/22+seed, 1100) * 4; h = Math.max(24, Math.min(34, h)); }
  else if (biome === 'ice_spikes') { h = 28 + noise(wx/20+seed, wz/20+seed, 1150) * 10; h = Math.max(25, Math.min(45, h)); }
  else if (biome === 'taiga') { h = 28 + noise(wx/25+seed, wz/25+seed, 1200) * 7; h = Math.max(24, Math.min(42, h)); }
  else if (biome === 'mesa') { h = 35 + noise(wx/18+seed, wz/18+seed, 1250) * 12; h = Math.max(30, Math.min(58, h)); }
  else if (biome === 'jungle') { h = 24 + noise(wx/20+seed, wz/20+seed, 1350) * 10; h = Math.max(20, Math.min(48, h)); }
  else if (biome === 'dark_forest') { h = 26 + noise(wx/22+seed, wz/22+seed, 1400) * 8; h = Math.max(22, Math.min(44, h)); }
  else { h += noise(wx/25+seed, wz/25+seed, 300) * 8; h = Math.max(20, Math.min(50, h)); }
  return Math.max(1, Math.min(WORLD_HEIGHT - 1, Math.floor(h)));
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
  if (y < 0 || y >= WORLD_HEIGHT) return AIR;
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

// ==================== ГЕНЕРАЦИЯ ДЕРЕВЬЕВ ====================
function generateOakTree(editsMap, cx, cz, groundY) {
  const h = 5 + Math.floor(Math.random() * 2);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD);
  const leafRad = 2;
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -leafRad; dx <= leafRad; dx++) {
      for (let dz = -leafRad; dz <= leafRad; dz++) {
        const dist = Math.abs(dx) + Math.abs(dz) + Math.abs(dy);
        if (dist <= leafRad + 0.5 && (dy + h) > 0) editsMap.set(`${cx + dx},${groundY + h - 1 + dy},${cz + dz}`, LEAVES);
      }
    }
  }
}

function generatePineTree(editsMap, cx, cz, groundY) {
  const h = 7 + Math.floor(Math.random() * 4);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD);
  for (let i = 0; i < 4; i++) {
    const yOff = h - 2 - i * 2; const rad = 2 - i; if (rad < 1) continue;
    for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.abs(dx) + Math.abs(dz) <= rad) editsMap.set(`${cx + dx},${groundY + yOff + i},${cz + dz}`, LEAVES);
  }
}

function generatePalmTree(editsMap, cx, cz, groundY) {
  const h = 4 + Math.floor(Math.random() * 3);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 2) editsMap.set(`${cx + dx},${groundY + h - 1},${cz + dz}`, LEAVES);
  editsMap.set(`${cx},${groundY + h},${cz}`, LEAVES); editsMap.set(`${cx + 1},${groundY + h},${cz}`, LEAVES); editsMap.set(`${cx - 1},${groundY + h},${cz}`, LEAVES);
}

function generateCherryTree(editsMap, cx, cz, groundY) {
  const h = 4 + Math.floor(Math.random() * 3);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, CHERRY_LOG);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 2) editsMap.set(`${cx + dx},${groundY + h - 1},${cz + dz}`, CHERRY_LEAVES);
}

function generateSwampTree(editsMap, cx, cz, groundY) {
  const h = 5 + Math.floor(Math.random() * 2);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 2) editsMap.set(`${cx + dx},${groundY + h - 1 + dy},${cz + dz}`, LEAVES);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let i = 1; i <= 2; i++) editsMap.set(`${cx + dx},${groundY + h - 1 - i},${cz + dz}`, LEAVES);
}

function generateGiantTree(editsMap, cx, cz, groundY) {
  const h = 8 + Math.floor(Math.random() * 5);
  for (let y = 0; y < h; y++) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { if (dx === 0 && dz === 0) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD); else if (y < h - 2) editsMap.set(`${cx + dx},${groundY + y},${cz + dz}`, WOOD); }
  const rad = 4;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.sqrt(dx*dx + dz*dz + dy*dy) <= rad) editsMap.set(`${cx + dx},${groundY + h - 2 + dy},${cz + dz}`, LEAVES);
}

function generateDeadTree(editsMap, cx, cz, groundY) {
  const h = 3 + Math.floor(Math.random() * 3);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD);
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (Math.random() < 0.3) editsMap.set(`${cx + dx},${groundY + h - 1},${cz + dz}`, WOOD);
}

function generateJungleTree(editsMap, cx, cz, groundY) {
  const h = 6 + Math.floor(Math.random() * 5);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD);
  const rad = 3;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.sqrt(dx*dx + dz*dz + dy*dy) <= rad) editsMap.set(`${cx + dx},${groundY + h - 2 + dy},${cz + dz}`, LEAVES);
  for (let i = 1; i <= 3; i++) { editsMap.set(`${cx + 1},${groundY + h - i},${cz}`, LEAVES); editsMap.set(`${cx - 1},${groundY + h - i},${cz}`, LEAVES); }
}

function generateMegaTaigaTree(editsMap, cx, cz, groundY) {
  const h = 12 + Math.floor(Math.random() * 5); const trunkW = 2;
  for (let y = 0; y < h; y++) for (let dx = -trunkW; dx <= trunkW; dx++) for (let dz = -trunkW; dz <= trunkW; dz++) if (Math.abs(dx) + Math.abs(dz) <= trunkW) editsMap.set(`${cx + dx},${groundY + y},${cz + dz}`, WOOD);
  for (let i = 0; i < 5; i++) { const yOff = h - 3 - i * 2; const rad = 3 - i; for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.abs(dx) + Math.abs(dz) <= rad) editsMap.set(`${cx + dx},${groundY + yOff + i},${cz + dz}`, LEAVES); }
}

function generateBamboo(editsMap, cx, cz, groundY) {
  const h = 3 + Math.floor(Math.random() * 4);
  for (let y = 0; y < h; y++) editsMap.set(`${cx},${groundY + y},${cz}`, BAMBOO);
}

// ==================== ГЕНЕРАЦИЯ СТРУКТУР ====================
function generatePortal(editsMap, cx, cz, groundY) {
  const size = 7; const startX = cx - Math.floor(size/2), startZ = cz - Math.floor(size/2);
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) if (x === 0 || x === size-1 || z === 0 || z === size-1) for (let y = 0; y < size; y++) { if (y === size-1) continue; editsMap.set(`${startX + x},${groundY + y},${startZ + z}`, OBSIDIAN); }
  for (let x = 1; x < size-1; x++) for (let z = 1; z < size-1; z++) for (let y = 1; y < size-1; y++) editsMap.set(`${startX + x},${groundY + y},${startZ + z}`, AIR);
}
function generateStoneCircle(editsMap, cx, cz, groundY) { for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) { const dx = Math.round(Math.cos(angle) * 4); const dz = Math.round(Math.sin(angle) * 4); editsMap.set(`${cx + dx},${groundY},${cz + dz}`, STONE); editsMap.set(`${cx + dx},${groundY + 1},${cz + dz}`, MOSSY_STONE); } }
function generateDruidAltar(editsMap, cx, cz, groundY) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) editsMap.set(`${cx + dx},${groundY},${cz + dz}`, STONE); editsMap.set(`${cx},${groundY + 1},${cz}`, GLOWSTONE); }
function generateSmallPyramid(editsMap, cx, cz, groundY) { for (let y = 0; y < 3; y++) { const s = 3 - y; for (let dx = -s; dx <= s; dx++) for (let dz = -s; dz <= s; dz++) if (Math.abs(dx) === s || Math.abs(dz) === s) editsMap.set(`${cx + dx},${groundY + y},${cz + dz}`, SANDSTONE); } }
function generateRuins(editsMap, cx, cz, groundY) { for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { if (Math.random() < 0.6) { editsMap.set(`${cx + dx},${groundY},${cz + dz}`, MOSSY_STONE); if (Math.random() < 0.3) editsMap.set(`${cx + dx},${groundY + 1},${cz + dz}`, MOSSY_STONE); } } }
function generateDolmen(editsMap, cx, cz, groundY) { for (let i = -1; i <= 1; i++) { editsMap.set(`${cx + i},${groundY},${cz}`, STONE); editsMap.set(`${cx + i},${groundY + 1},${cz}`, STONE); editsMap.set(`${cx + i},${groundY + 2},${cz}`, STONE); } for (let i = -1; i <= 1; i++) { editsMap.set(`${cx + i},${groundY + 3},${cz - 1}`, STONE); editsMap.set(`${cx + i},${groundY + 3},${cz + 1}`, STONE); } editsMap.set(`${cx},${groundY + 3},${cz}`, STONE); }
function generateWell(editsMap, cx, cz, groundY) { for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) editsMap.set(`${cx + dx},${groundY},${cz + dz}`, STONE); }
function generateTotemPole(editsMap, cx, cz, groundY) { for (let y = 0; y < 4; y++) editsMap.set(`${cx},${groundY + y},${cz}`, WOOD); editsMap.set(`${cx},${groundY + 4},${cz}`, PLANKS); editsMap.set(`${cx},${groundY + 5},${cz}`, PLANKS); editsMap.set(`${cx + 1},${groundY + 4},${cz}`, PLANKS); editsMap.set(`${cx - 1},${groundY + 4},${cz}`, PLANKS); }
function generateHangingGarden(editsMap, cx, cz, groundY) { for (let y = 0; y < 3; y++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 2) editsMap.set(`${cx + dx},${groundY + y},${cz + dz}`, DIRT); for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dz) <= 2) { editsMap.set(`${cx + dx},${groundY + 3},${cz + dz}`, GRASS); if (Math.random() < 0.5) editsMap.set(`${cx + dx},${groundY + 4},${cz + dz}`, LEAVES); } }
function generateIceSpike(editsMap, cx, cz, groundY) { const h = 5 + Math.floor(Math.random() * 6); for (let y = 0; y < h; y++) { const rad = Math.max(0, Math.floor((h - y) / 2)); for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) if (Math.abs(dx) + Math.abs(dz) <= rad) editsMap.set(`${cx + dx},${groundY + y},${cz + dz}`, PACKED_ICE); } }
function generateHouse(editsMap, cx, cz, groundY) { const width = 8, height = 6, depth = 8; const startX = cx - width/2, startZ = cz - depth/2; for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) for (let y = 0; y < height; y++) { const wx = startX + x, wz = startZ + z, wy = groundY + y; if (wy >= WORLD_HEIGHT) continue; if (x === 0 || x === width-1 || z === 0 || z === depth-1 || y === 0 || y === height-1) { if (z === 0 && x >= 3 && x <= 4 && y >= 1 && y <= 2) continue; editsMap.set(`${wx},${wy},${wz}`, (y === 0) ? PLANKS : WOOD); } } }
function generatePyramid(editsMap, cx, cz, groundY) { const size = 9; const startX = cx - Math.floor(size/2), startZ = cz - Math.floor(size/2); for (let y = 0; y < size; y++) { const s = size - y; for (let x = 0; x < s; x++) for (let z = 0; z < s; z++) { const wx = startX + x + y/2, wz = startZ + z + y/2, wy = groundY + y; if (wy >= WORLD_HEIGHT) continue; if (x === 0 || x === s-1 || z === 0 || z === s-1 || y === size-1) editsMap.set(`${wx},${wy},${wz}`, SANDSTONE); } } }
function generateIgloo(editsMap, cx, cz, groundY) { const radius = 4; for (let dx = -radius; dx <= radius; dx++) for (let dz = -radius; dz <= radius; dz++) { const dist = Math.sqrt(dx*dx + dz*dz); if (dist > radius) continue; const height = Math.floor(radius - dist); for (let y = 0; y <= height; y++) { const wy = groundY + y; if (wy >= WORLD_HEIGHT) continue; editsMap.set(`${cx + dx},${wy},${cz + dz}`, y === height ? SNOW_BLOCK : ICE); } } editsMap.set(`${cx},${groundY+1},${cz - radius}`, AIR); }
function generateJungleTemple(editsMap, cx, cz, groundY) { const width = 8, height = 6, depth = 8; const startX = cx - width/2, startZ = cz - depth/2; for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) for (let y = 0; y < height; y++) { const wx = startX + x, wz = startZ + z, wy = groundY + y; if (wy >= WORLD_HEIGHT) continue; if (x === 0 || x === width-1 || z === 0 || z === depth-1 || y === 0 || y === height-1) { if (z === 0 && x >= 3 && x <= 4 && y >= 1 && y <= 2) continue; editsMap.set(`${wx},${wy},${wz}`, MOSSY_STONE); } } }
function generateWitchHut(editsMap, cx, cz, groundY) { const width = 7, height = 5, depth = 7; const startX = cx - width/2, startZ = cz - depth/2; for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) { const wy = groundY; if (wy >= WORLD_HEIGHT) continue; if (Math.abs(x - width/2) < 2 && Math.abs(z - depth/2) < 2) editsMap.set(`${startX+x},${wy},${startZ+z}`, PLANKS); else editsMap.set(`${startX+x},${wy-1},${startZ+z}`, WOOD); if (x === 0 || x === width-1 || z === 0 || z === depth-1) for (let y = 1; y < height; y++) { const wy2 = groundY + y; if (wy2 >= WORLD_HEIGHT) continue; editsMap.set(`${startX+x},${wy2},${startZ+z}`, WOOD); } } }
function generateShipwreck(editsMap, cx, cz, groundY) { const length = 10, width = 4, height = 3; const startX = cx - length/2, startZ = cz - width/2; for (let l = 0; l < length; l++) for (let w = 0; w < width; w++) for (let h = 0; h < height; h++) { const wx = startX + l, wz = startZ + w, wy = groundY + h; if (wy >= WORLD_HEIGHT) continue; if (h === 0) editsMap.set(`${wx},${wy},${wz}`, PLANKS); else if (l === 0 || l === length-1 || w === 0 || w === width-1) editsMap.set(`${wx},${wy},${wz}`, WOOD); } }
function generateGiantMushroom(editsMap, cx, cz, groundY) { const height = 6, capRadius = 4; for (let y = 0; y < height; y++) editsMap.set(`${cx},${groundY + y},${cz}`, MUSHROOM_STEM); for (let dx = -capRadius; dx <= capRadius; dx++) for (let dz = -capRadius; dz <= capRadius; dz++) if (Math.sqrt(dx*dx + dz*dz) <= capRadius) editsMap.set(`${cx+dx},${groundY+height-1},${cz+dz}`, RED_MUSHROOM); }
function generateObsidianTower(editsMap, cx, cz, groundY) { const height = 12, width = 3; for (let y = 0; y < height; y++) for (let x = -width; x <= width; x++) for (let z = -width; z <= width; z++) if (Math.abs(x) === width || Math.abs(z) === width || y === 0 || y === height-1) editsMap.set(`${cx+x},${groundY+y},${cz+z}`, OBSIDIAN); }
function generateEndCity(editsMap, cx, cz, groundY) { const height = 8; for (let y = 0; y < height; y++) for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) if (!(Math.abs(x) === 2 && Math.abs(z) === 2)) editsMap.set(`${cx+x},${groundY+y},${cz+z}`, (y % 2 === 0) ? PURPUR : END_STONE); }
function generateDungeon(editsMap, cx, cz, groundY) { for (let y = 0; y < 3; y++) for (let x = -1; x <= 1; x++) editsMap.set(`${cx+x},${groundY + y + 1},${cz}`, (y === 1 && x === 0) ? AIR : STONE); const roomY = groundY - 3; for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) for (let y = -2; y <= 2; y++) { const wy = roomY + y; if (wy < 0) continue; if (Math.abs(x) === 3 || Math.abs(z) === 3 || y === -2 || y === 2) editsMap.set(`${cx+x},${wy},${cz+z}`, MOSSY_STONE); else editsMap.set(`${cx+x},${wy},${cz+z}`, AIR); } }

// ==================== ИНИЦИАЛИЗАЦИЯ МИРА ====================
seed = Math.floor(Math.random() * 10000);
const edits = new Map();
const players = new Map();
let nextId = 1;

for (let cx = -25; cx <= 25; cx++) {
  for (let cz = -25; cz <= 25; cz++) {
    const centerX = cx * 16 + 8, centerZ = cz * 16 + 8;
    const biome = getCachedBiome(centerX, centerZ);
    const groundY = getCachedHeight(centerX, centerZ);
    if (groundY > 2 && groundY < WORLD_HEIGHT - 8) {
      if (Math.random() < 0.02) {
        if (biome === 'taiga') generatePineTree(edits, centerX, centerZ, groundY);
        else if (biome === 'jungle') generateJungleTree(edits, centerX, centerZ, groundY);
        else if (biome === 'cherry_grove') generateCherryTree(edits, centerX, centerZ, groundY);
        else if (biome === 'swamp') generateSwampTree(edits, centerX, centerZ, groundY);
        else if (biome === 'dark_forest') generateGiantTree(edits, centerX, centerZ, groundY);
        else if (biome === 'desert') generateDeadTree(edits, centerX, centerZ, groundY);
        else if (biome === 'savanna') generatePalmTree(edits, centerX, centerZ, groundY);
        else if (biome === 'forest' || biome === 'plains') generateOakTree(edits, centerX, centerZ, groundY);
        else if (biome === 'mountain') generatePineTree(edits, centerX, centerZ, groundY);
        else if (biome === 'bamboo_forest') generateBamboo(edits, centerX, centerZ, groundY);
      }
      if (Math.random() < 0.005) {
        const r = Math.random();
        if (biome === 'plains' && r < 0.15) generatePortal(edits, centerX, centerZ, groundY);
        else if (biome === 'plains' && r < 0.3) generateStoneCircle(edits, centerX, centerZ, groundY);
        else if (biome === 'forest' && r < 0.2) generateDruidAltar(edits, centerX, centerZ, groundY);
        else if (biome === 'desert' && r < 0.25) generateSmallPyramid(edits, centerX, centerZ, groundY);
        else if (biome === 'mountain' && r < 0.2) generateRuins(edits, centerX, centerZ, groundY);
        else if (biome === 'ice' && r < 0.2) generateIceSpike(edits, centerX, centerZ, groundY);
        else if (biome === 'snow' && r < 0.2) generateIgloo(edits, centerX, centerZ, groundY);
        else if (biome === 'savanna' && r < 0.2) generateDolmen(edits, centerX, centerZ, groundY);
        else if (biome === 'swamp' && r < 0.2) generateWell(edits, centerX, centerZ, groundY);
        else if (biome === 'mesa' && r < 0.2) generateTotemPole(edits, centerX, centerZ, groundY);
        else if (biome === 'jungle' && r < 0.2) generateHangingGarden(edits, centerX, centerZ, groundY);
        else if (biome === 'coral_reef') generateShipwreck(edits, centerX, centerZ, groundY);
        else if (biome === 'mushroom') generateGiantMushroom(edits, centerX, centerZ, groundY);
        else if (biome === 'volcanic') generateObsidianTower(edits, centerX, centerZ, groundY);
        else if (biome === 'end_highlands') generateEndCity(edits, centerX, centerZ, groundY);
        else generateHouse(edits, centerX, centerZ, groundY);
      }
    }
    if (biome === 'desert' && Math.random() < 0.02) {
      const cactusHeight = 1 + Math.floor(Math.random() * 2);
      for (let h = 0; h < cactusHeight; h++) edits.set(`${centerX},${groundY + h},${centerZ}`, CACTUS);
    }
  }
}

// ==================== СУЩНОСТИ И МОБЫ ====================
let nextEntityId = 1;
const entities = new Map();

const MOB_TYPES = {
  zombie: { health: 30, maxHealth: 30, walkSpeed: 3.0, damage: 3.0, damageDistance: 2.0, attackCooldown: 1.0, width: 0.6, height: 1.8, color: 0x44aa44, gravity: 1, jumpPower: 12.0, slimeSize: 0 },
  skeleton: { health: 20, maxHealth: 20, walkSpeed: 4.0, damage: 4.0, damageDistance: 5.0, attackCooldown: 1.5, width: 0.6, height: 1.8, color: 0xcccccc, gravity: 1, jumpPower: 12.0, slimeSize: 0 },
  ghost: { health: 15, maxHealth: 15, walkSpeed: 3.0, damage: 2.0, damageDistance: 3.0, attackCooldown: 1.0, width: 0.6, height: 1.8, color: 0x88aaff, gravity: 0, jumpPower: 0, slimeSize: 0 },
  slime: { health: 20, maxHealth: 20, walkSpeed: 1.5, damage: 2.0, damageDistance: 1.5, attackCooldown: 1.0, width: 0.6, height: 0.6, color: 0x88dd88, gravity: 1, jumpPower: 8.0, slimeSize: 1.0 },
};

class Entity {
  constructor(type, x, y, z, data = {}) {
    this.id = nextEntityId++;
    this.type = type;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;
    this.alive = true;

    if (type === 'mob') {
      let mobData = data;
      if (typeof data === 'string') mobData = parseMobData(data);
      const mobType = mobData.mobType || 'zombie';
      const defaults = MOB_TYPES[mobType] || MOB_TYPES.zombie;
      
      this.mobType = mobType;
      this.hp = mobData.health ?? defaults.health;
      this.maxHp = mobData.maxHealth ?? defaults.maxHealth;
      this.walkSpeed = mobData.walkSpeed ?? defaults.walkSpeed;
      this.damage = mobData.damage ?? defaults.damage;
      this.damageDistance = mobData.damageDistance ?? defaults.damageDistance;
      this.attackCooldown = mobData.attackCooldown ?? defaults.attackCooldown;
      
      const sizeFactor = mobData.slimeSize ?? defaults.slimeSize ?? 0;
      this.width = (mobData.width ?? defaults.width) * (sizeFactor > 0 ? sizeFactor : 1);
      this.height = (mobData.height ?? defaults.height) * (sizeFactor > 0 ? sizeFactor : 1);
      this.color = mobData.color ?? defaults.color;
      this.gravity = mobData.gravity ?? defaults.gravity ?? 1;
      this.jumpPower = mobData.jumpPower ?? defaults.jumpPower ?? 12.0;
      this.slimeSize = sizeFactor;
      this.lastAttackTime = 0;
      this.onGround = false;
    } else {
      this.data = data;
      this.hitboxRadius = data.hitboxRadius || 0.5;
    }
  }
}

// ИСПРАВЛЕНИЕ: Карта конвертации snake_case в camelCase
const MOB_KEY_MAP = {
  'mob': 'mobType', 'damage_distance': 'damageDistance', 'walk_speed': 'walkSpeed',
  'max_health': 'maxHealth', 'jump_power': 'jumpPower', 'slime_size': 'slimeSize',
  'attack_cooldown': 'attackCooldown'
};

function parseMobData(str) {
  const result = {};
  const parts = str.split(',');
  for (const part of parts) {
    const [key, value] = part.split(':');
    if (!key || value === undefined) continue;
    const trimmedKey = MOB_KEY_MAP[key.trim()] || key.trim();
    let numVal = parseFloat(value.trim());
    result[trimmedKey] = !isNaN(numVal) ? numVal : value.trim();
  }
  return result;
}

function spawnEntity(type, x, y, z, data = {}) {
  const entity = new Entity(type, x, y, z, data);
  entities.set(entity.id, entity);
  broadcast('entitySpawn', {
    id: entity.id, type: entity.type, x: entity.x, y: entity.y, z: entity.z, yaw: entity.yaw, pitch: entity.pitch,
    data: entity.type === 'mob' ? {
      mobType: entity.mobType, hp: entity.hp, maxHp: entity.maxHp, color: entity.color,
      width: entity.width, height: entity.height, gravity: entity.gravity, slimeSize: entity.slimeSize,
    } : entity.data,
  });
  return entity.id;
}

function despawnEntity(id) {
  const entity = entities.get(id);
  if (!entity) return;
  entity.alive = false;
  entities.delete(id);
  broadcast('entityDespawn', { id });
}

function damageEntity(entityId, dmg, src = {}) {
  const entity = entities.get(entityId);
  if (!entity || !entity.alive || entity.type !== 'mob' || dmg <= 0) return;
  entity.hp -= dmg;
  if (entity.hp <= 0) {
    despawnEntity(entityId);
    broadcast('systemMessage', { message: `Моб ${entity.mobType} убит!` });
  } else {
    broadcast('entityHp', { id: entityId, hp: entity.hp, maxHp: entity.maxHp });
  }
}

// ИСПРАВЛЕНИЕ: Функция проверки линии прямой видимости
function hasLineOfSight(x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
  const dist = Math.hypot(dx, dy, dz);
  if (dist === 0) return true;
  const steps = Math.ceil(dist * 2);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (getBlockType(Math.floor(x1 + dx * t), Math.floor(y1 + dy * t), Math.floor(z1 + dz * t)) !== 0) return false;
  }
  return true;
}

function moveMobGround(entity, dx, dz, dt) {
  const halfW = entity.width / 2;
  const height = entity.height;
  const gravityAccel = 20.0;
  function collidesAt(x, z, y) {
    const minX = Math.floor(x - halfW), maxX = Math.floor(x + halfW);
    const minZ = Math.floor(z - halfW), maxZ = Math.floor(z + halfW);
    const startY = Math.floor(y), endY = Math.floor(y + height - 0.01);
    for (let by = startY; by <= endY; by++)
      for (let bx = minX; bx <= maxX; bx++)
        for (let bz = minZ; bz <= maxZ; bz++)
          if (getBlockType(bx, by, bz) !== 0) return true;
    return false;
  }
  const newX = entity.x + dx * dt;
  if (!collidesAt(newX, entity.z, entity.y)) { entity.x = newX; } else { entity.vx = 0; if (entity.onGround && entity.jumpPower > 0) { entity.vy = entity.jumpPower; entity.onGround = false; } }
  const newZ = entity.z + dz * dt;
  if (!collidesAt(entity.x, newZ, entity.y)) { entity.z = newZ; } else { entity.vz = 0; if (entity.onGround && entity.jumpPower > 0) { entity.vy = entity.jumpPower; entity.onGround = false; } }
  entity.vy -= gravityAccel * dt;
  const newY = entity.y + entity.vy * dt;
  if (!collidesAt(entity.x, entity.z, newY)) { entity.y = newY; entity.onGround = false; }
  else { if (entity.vy < 0) { entity.y = Math.floor(entity.y) + 0.1; entity.vy = 0; entity.onGround = true; } else { entity.vy = 0; } }
  if (entity.y < 0) { const groundY = getCachedHeight(Math.floor(entity.x), Math.floor(entity.z)); entity.y = groundY + 0.1; entity.vy = 0; entity.onGround = true; }
}

function moveMobFlying(entity, targetX, targetY, targetZ, dt) {
  const dx = targetX - entity.x, dy = targetY - entity.y, dz = targetZ - entity.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.1) return;
  const speed = entity.walkSpeed;
  entity.x += (dx / dist) * speed * dt;
  entity.y += (dy / dist) * speed * dt;
  entity.z += (dz / dist) * speed * dt;
  if (entity.y < 0) entity.y = 0;
}

function mergeMobs(entity, dt) {
  if (entity.slimeSize <= 0) return false;
  let target = null;
  for (const [id, e] of entities) {
    if (e.id === entity.id || !e.alive || e.type !== 'mob' || e.slimeSize <= 0) continue;
    if (Math.hypot(e.x - entity.x, e.z - entity.z) < 2.0) { target = e; break; }
  }
  if (!target) return false;
  const newSize = entity.slimeSize + target.slimeSize;
  const newHealth = Math.min(entity.hp + target.hp, entity.maxHp + target.maxHp);
  despawnEntity(entity.id); despawnEntity(target.id);
  spawnMob((entity.x + target.x) / 2, (entity.y + target.y) / 2, (entity.z + target.z) / 2, { mobType: 'slime', health: newHealth, maxHealth: entity.maxHp + target.maxHp, slimeSize: newSize, color: 0x88dd88, gravity: 1 });
  broadcast('systemMessage', { message: `Слизни слились! Размер: ${newSize.toFixed(1)}` });
  return true;
}

// ИСПРАВЛЕНИЕ: Полностью переписанная логика обновления моба
function updateMob(entity, dt) {
  if (entity.type !== 'mob') return;

  if (entity.slimeSize > 0) {
    if (!entity._mergeCooldown) entity._mergeCooldown = 0;
    entity._mergeCooldown -= dt;
    if (entity._mergeCooldown <= 0) { entity._mergeCooldown = 1.0; if (mergeMobs(entity, dt)) return; }
  }

  let nearestPlayer = null;
  let minTotalDist = Infinity;

  // Ищем с учетом 3D расстояния (X, Y, Z)
  for (const [id, p] of players) {
    const dx = p.x - entity.x;
    const dy = p.y - entity.y;
    const dz = p.z - entity.z;
    const dist = Math.hypot(dx, dy, dz); 
    if (dist < 20 && dist < minTotalDist) {
      minTotalDist = dist;
      nearestPlayer = { id, x: p.x, y: p.y, z: p.z, dy };
    }
  }

  if (!nearestPlayer) {
    if (entity.gravity > 0) moveMobGround(entity, 0, 0, dt);
    broadcast('entityUpdate', { id: entity.id, x: entity.x, y: entity.y, z: entity.z, yaw: entity.yaw, pitch: entity.pitch });
    return;
  }

  // Логика Атаки
  const isRanged = (entity.mobType === 'skeleton');
  const vertDist = Math.abs(nearestPlayer.dy);
  const heightLimit = isRanged ? 8 : (entity.height + 1.5);
  
  // Проверка дистанции, высоты и прямой видимости
  if (minTotalDist <= entity.damageDistance && vertDist <= heightLimit) {
    const eyeY = entity.y + entity.height * 0.8;
    const pEyeY = nearestPlayer.y + 0.9;
    
    if (hasLineOfSight(entity.x, eyeY, entity.z, nearestPlayer.x, pEyeY, nearestPlayer.z)) {
      entity.yaw = Math.atan2(nearestPlayer.x - entity.x, nearestPlayer.z - entity.z);
      const now = Date.now() / 1000;
      if (now - entity.lastAttackTime >= entity.attackCooldown) {
        entity.lastAttackTime = now;
        applyDamage(nearestPlayer.id, entity.damage, { ax: entity.x, az: entity.z, kb: 1, attackerId: null, weapon: `моб ${entity.mobType}` });
      }
    }
  }

  // Логика Движения
  if (entity.gravity === 0) {
    moveMobFlying(entity, nearestPlayer.x, nearestPlayer.y + 0.5, nearestPlayer.z, dt);
  } else {
    const dx = nearestPlayer.x - entity.x;
    const dz = nearestPlayer.z - entity.z;
    const hDist = Math.hypot(dx, dz);
    
    // Скелет останавливается на дистанции стрельбы, остальные подбегают
    const stopDist = isRanged ? entity.damageDistance * 0.8 : entity.damageDistance * 0.8;
    
    if (hDist > stopDist) {
      entity.vx = (dx / hDist) * entity.walkSpeed;
      entity.vz = (dz / hDist) * entity.walkSpeed;
      entity.yaw = Math.atan2(dx, dz);
    } else {
      entity.vx = 0; entity.vz = 0;
    }
    moveMobGround(entity, entity.vx, entity.vz, dt);
  }

  broadcast('entityUpdate', { id: entity.id, x: entity.x, y: entity.y, z: entity.z, yaw: entity.yaw, pitch: entity.pitch });
}

function updateEntities(dt) {
  for (const entity of entities.values()) {
    if (!entity.alive) continue;
    if (entity.type === 'mob') updateMob(entity, dt);
  }
}

function spawnMob(x, y, z, mobData) {
  if (typeof mobData === 'string') mobData = parseMobData(mobData);
  if (!mobData.mobType) mobData.mobType = 'zombie';
  if (mobData.slimeSize === undefined) { const defaults = MOB_TYPES[mobData.mobType] || MOB_TYPES.zombie; mobData.slimeSize = defaults.slimeSize || 0; }
  return spawnEntity('mob', x, y, z, mobData);
}

function handleSpawnMobCommand(senderId, args) {
  const player = players.get(senderId);
  if (!player) return;
  const x = player.x + 2, z = player.z + 2;
  const y = getCachedHeight(Math.floor(x), Math.floor(z)) + 1;
  let mobData = 'mob:zombie,health:30,max_health:30,walk_speed:3,damage:3,damage_distance:2,gravity:1,slimeSize:0';
  if (args.length > 0) mobData = args.join(' ');
  const id = spawnMob(x, y, z, mobData);
  broadcast('systemMessage', { message: `${player.nickname} призвал моба (id ${id})` });
}

const testMobs = [
  { x: 5, z: 5, data: 'mob:zombie,health:30,walk_speed:2.5,damage:4,damage_distance:2,gravity:1,slimeSize:0' },
  { x: -5, z: -5, data: 'mob:skeleton,health:20,walk_speed:4,damage:5,damage_distance:5,gravity:1,slimeSize:0' },
  { x: 10, z: -5, data: 'mob:ghost,health:15,walk_speed:3,damage:2,damage_distance:3,gravity:0,slimeSize:0' },
  { x: -8, z: 8, data: 'mob:slime,health:20,slimeSize:1.0,damage:2,walk_speed:1.5,damage_distance:1.5,gravity:1' },
  { x: -6, z: 10, data: 'mob:slime,health:15,slimeSize:0.8,damage:1.5,walk_speed:1.2,damage_distance:1.5,gravity:1' },
];
for (const m of testMobs) {
  const y = getCachedHeight(Math.floor(m.x), Math.floor(m.z)) + 1;
  spawnMob(m.x, y, m.z, m.data);
}

// ==================== WebSocket СЕРВЕР ====================
const wss = new WebSocketServer({ server: httpServer });
function send(ws, type, data) { if (ws.readyState === 1) ws.send(JSON.stringify({ type, ...data })); }
function broadcast(type, data, exceptId = null) {
  const msg = JSON.stringify({ type, ...data });
  for (const [id, q] of players) if (id !== exceptId && q.ws.readyState === 1) q.ws.send(msg);
}
function syncEffects(q) { send(q.ws, 'effects', { list: [...q.effects].map(([e, v]) => ({ e, until: v.until, power: v.power })) }); }

// Восстановленная функция applyDamage
function applyDamage(targetId, dmg, src = {}) {
  if (typeof targetId === 'string' && targetId.startsWith('mob_')) {
    const entityId = parseInt(targetId.slice(4), 10);
    damageEntity(entityId, dmg, src);
    return;
  }

  const target = players.get(targetId);
  if (!target) return;
  const attackerId = src.attackerId;
  const attacker = attackerId ? players.get(attackerId) : null;
  
  if (src.weapon?.includes('огн') && target.effects.has('fire_resist')) dmg *= (1 - target.effects.get('fire_resist').power);
  if (target.effects.has('vulnerability')) dmg *= 1.5;
  if (target.effects.has('weakness')) dmg *= 0.5;
  
  const ward = target.effects.get('ward');
  if (ward && dmg > 0) { const abs = Math.min(ward.power, dmg); ward.power -= abs; dmg -= abs; if (ward.power <= 0) target.effects.delete('ward'); syncEffects(target); }
  
  const stoneskin = target.effects.get('stoneskin');
  dmg *= 1 - 0.04 * (target.armor + (stoneskin ? stoneskin.power : 0));
  
  if (dmg <= 0 && !(src.kb > 0)) return;
  
  if (target.effects.has('ice_skin') && attackerId && attackerId !== targetId && attacker) {
    if (!attacker.effects.has('freeze')) { attacker.effects.set('freeze', { until: Date.now() + (target.effects.get('ice_skin').power || 2) * 1000, power: 1 }); syncEffects(attacker); }
  }
  
  const wasAlive = target.hp > 0;
  target.hp -= Math.max(0, dmg);
  
  if (target.hp <= 4 && !target.phoenixUsed && target.effects.has('phoenix')) {
    target.phoenixUsed = true; target.hp = 8;
    broadcast('systemMessage', { message: `${target.nickname} возродился как Феникс!` });
    broadcast('hp', { id: targetId, hp: target.hp });
    return;
  }
  
  if (target.hp <= 0 && wasAlive) {
    target.hp = 50; target.effects.clear(); syncEffects(target);
    broadcast('respawn', { id: targetId });
    broadcast('hp', { id: targetId, hp: 50 });
    target.phoenixUsed = false;
    if (attackerId && attackerId !== targetId && attacker) {
      broadcast('systemMessage', { message: `${attacker.nickname} убил ${target.nickname}` });
    }
    return;
  }
  
  send(target.ws, 'damaged', { hp: target.hp, ax: src.ax, az: src.az, kb: src.kb || 0 });
  broadcast('hp', { id: targetId, hp: target.hp }, targetId);
}

// Контекст для магии
const magicCtx = {
  emit: (type, data) => broadcast(type, data),
  getBlock: (x, y, z) => getBlockType(x, y, z),
  setBlock: (x, y, z, t) => { edits.set(`${x},${y},${z}`, t); broadcast('blockUpdate', { x, y, z, t }); },
  getPlayers: () => players,
  applyDamage: applyDamage,
  addEffect: (id, eff, dur, pow) => { const p = players.get(id); if (p) { p.effects.set(eff, { until: Date.now() + dur * 1000, power: pow }); syncEffects(p); } },
  clearDebuffs: (id) => { const p = players.get(id); if(p){ for(const k of p.effects.keys()) if(!['ward','speed','levitate','regen'].includes(k)) p.effects.delete(k); syncEffects(p);}},
  getMana: (id) => players.get(id)?.mana || 0,
  spendMana: (id, cost) => { const p = players.get(id); if (p) { p.mana -= cost; send(p.ws, 'mana', { mana: p.mana }); } },
  healPlayer: (id, amt) => { const p = players.get(id); if (p) { p.hp = Math.min(100, p.hp + amt); send(p.ws, 'hp', { id, hp: p.hp }); broadcast('hp', { id, hp: p.hp }, id); } },
  terrainHeight: getCachedHeight,
  teleportPlayer: (id, x, y, z) => { const p = players.get(id); if(p){ p.x=x; p.y=y; p.z=z; send(p.ws, 'teleport', {id, x, y, z}); broadcast('teleport', {id, x, y, z}, id); } },
  stomp: () => {}, blackVortex: () => {}, addTotem: () => {}, addZone: () => {}, chainPlayers: () => {}, swapPositions: () => {}, createProtectionSphere: () => {}, summonAsteroid: () => {}, lightCage: () => {}, shadowShackles: () => {}, addTimeSlowZone: () => {}
};
const magic = createMagicEngine(magicCtx);

// Обработка подключений
wss.on('connection', (ws) => {
  const id = nextId++;
  const nickname = randomNickname();
  const spawnY = getCachedHeight(0, 0) + 2;
  
  const playerData = {
    ws, id, nickname, x: 0.5, y: spawnY, z: 0.5, yaw: 0, pitch: 0,
    hp: 50, mana: 20, maxMana: 20, armor: 0, effects: new Map(), phoenixUsed: false
  };
  players.set(id, playerData);

  send(ws, 'init', {
    id, nickname, seed,
    edits: [...edits.entries()],
    players: [...players.values()].filter(p => p.id !== id).map(p => ({ id: p.id, x: p.x, y: p.y, z: p.z, yaw: p.yaw, nickname: p.nickname })),
    entities: [...entities.values()].map(e => ({ id: e.id, type: e.type, x: e.x, y: e.y, z: e.z, yaw: e.yaw, pitch: e.pitch, data: e.type === 'mob' ? { mobType: e.mobType, hp: e.hp, maxHp: e.maxHp, color: e.color, width: e.width, height: e.height, gravity: e.gravity, slimeSize: e.slimeSize } : e.data })),
    snapshot: magic.getSnapshot()
  });

  broadcast('join', { id, nickname }, id);
  broadcast('systemMessage', { message: `${nickname} присоединился` });

  ws.on('message', (raw) => {
    try {
      const m = JSON.parse(raw);
      if (m.type === 'move') {
        playerData.x = m.x; playerData.y = m.y; playerData.z = m.z; playerData.yaw = m.yaw; playerData.pitch = m.pitch;
        broadcast('move', { id, x: m.x, y: m.y, z: m.z, yaw: m.yaw, pitch: m.pitch }, id);
      } else if (m.type === 'chat') {
        broadcast('chat', { senderId: id, senderNick: nickname, message: m.message });
      } else if (m.type === 'cast') {
        magic.cast(id, m.elements, m.dir, m.origin, m.yaw, m.hand);
      } else if (m.type === 'blockEdit') {
        edits.set(`${m.x},${m.y},${m.z}`, m.t);
        broadcast('blockUpdate', { x: m.x, y: m.y, z: m.z, t: m.t }, id);
      } else if (m.type === 'hit') {
        if (m.targetType === 'entity') damageEntity(m.targetId, m.damage || 5, { attackerId: id, weapon: 'оружие' });
      } else if (m.type === 'command') {
        if (m.command === 'spawnmob') handleSpawnMobCommand(id, m.args || []);
      }
    } catch (e) { console.error('Msg err:', e); }
  });

  ws.on('close', () => {
    players.delete(id);
    broadcast('leave', { id });
    broadcast('systemMessage', { message: `${nickname} покинул игру` });
  });
});

// Игровой цикл
const TICK_RATE = 50; 
setInterval(() => {
  const dt = TICK_RATE / 1000;
  updateEntities(dt);
  magic.tick(dt);
}, TICK_RATE);

httpServer.listen(3000, () => {
  console.log(`🚀 Сервер запущен на http://localhost:3000`);
});