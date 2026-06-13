// ========== Конфигурация ==========
const FULL_RADIUS = 9;          // 9 чанков во все стороны = 19x19 (~ 304 блока)
const LOD_RINGS = [
  { level: 2, radius: 24 },     // начинаем LOD дальше, чтобы не перекрывался с чанками
  { level: 3, radius: 48 },
];
const FULL_BUDGET = 8;          // одновременно генерируем до 8 чанков
const LOD_BUDGET = 6;

// Кэш мешей в IndexedDB
let meshCache = null;
async function initCache() {
  if (!window.indexedDB) return;
  const request = indexedDB.open('voxel-chunks', 1);
  request.onupgradeneeded = (e) => e.target.result.createObjectStore('meshes', { keyPath: 'key' });
  meshCache = await new Promise((resolve) => {
    request.onsuccess = () => resolve(request.result);
  });
}
initCache();

function saveMeshToCache(chunkKey, geometryData) {
  if (!meshCache) return;
  const tx = meshCache.transaction('meshes', 'readwrite');
  tx.objectStore('meshes').put({ key: chunkKey, positions: geometryData.positions, colors: geometryData.colors, indices: geometryData.indices });
  tx.commit();
}

async function loadMeshFromCache(chunkKey) {
  if (!meshCache) return null;
  const tx = meshCache.transaction('meshes', 'readonly');
  const store = tx.objectStore('meshes');
  const record = await new Promise((resolve) => {
    const req = store.get(chunkKey);
    req.onsuccess = () => resolve(req.result);
  });
  if (!record) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(record.positions), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(record.colors), 3));
  geometry.setIndex(record.indices);
  return new THREE.Mesh(geometry, CHUNK_MATERIAL);
}

// Асинхронное построение меша (через requestIdleCallback)
function buildMeshAsync(chunk, callback) {
  requestIdleCallback(() => {
    const mesh = buildChunkMesh(world, chunk);
    callback(mesh);
  }, { timeout: 100 });
}

// Функция remeshChunk переписана с асинхронным кэшем
function remeshChunk(chunk) {
  if (chunk.mesh) { scene.remove(chunk.mesh); chunk.mesh.geometry.dispose(); }
  const chunkKey = `c_${chunk.cx}_${chunk.cz}`;
  loadMeshFromCache(chunkKey).then(cachedMesh => {
    if (cachedMesh) {
      chunk.mesh = cachedMesh;
      scene.add(chunk.mesh);
    } else {
      buildMeshAsync(chunk, (mesh) => {
        chunk.mesh = mesh;
        scene.add(mesh);
        // Сохраняем в кэш (извлекаем геометрию)
        const posAttr = mesh.geometry.attributes.position.array;
        const colAttr = mesh.geometry.attributes.color.array;
        const idx = mesh.geometry.index.array;
        saveMeshToCache(chunkKey, { positions: Array.from(posAttr), colors: Array.from(colAttr), indices: Array.from(idx) });
      });
    }
  });
}

// Менеджер чанков (основная логика) – остаётся без изменений, кроме FULL_RADIUS и бюджетов
function chunkManagerTick() {
  if (!world) return;
  const pcx = Math.floor(player.pos.x / CHUNK_SIZE);
  const pcz = Math.floor(player.pos.z / CHUNK_SIZE);

  const wantFull = new Set(), missing = [];
  for (let dx = -FULL_RADIUS; dx <= FULL_RADIUS; dx++)
    for (let dz = -FULL_RADIUS; dz <= FULL_RADIUS; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      wantFull.add(world.key(cx, cz));
      if (!world.getChunk(cx, cz)) missing.push([cx, cz, dx*dx + dz*dz]);
    }
  missing.sort((a,b) => a[2]-b[2]);
  let built = 0;
  for (const [cx, cz] of missing) {
    if (built >= FULL_BUDGET) break;
    const chunk = world.generateChunk(cx, cz);
    remeshChunk(chunk);
    built++;
    // перестроить соседей при необходимости
    for (const [nx, nz] of [[cx+1,cz],[cx-1,cz],[cx,cz+1],[cx,cz-1]]) {
      const nb = world.getChunk(nx, nz);
      if (nb?.mesh) remeshChunk(nb);
    }
  }
  // удалить дальние
  for (const [key, c] of world.chunks) {
    if (!wantFull.has(key)) {
      if (c.mesh) { scene.remove(c.mesh); c.mesh.geometry.dispose(); }
      world.chunks.delete(key);
    }
  }

  // LOD – оставляем как раньше, но уровень 1 отключён, чтобы не перекрывался
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
  let lodBuilt = 0;
  for (const [key, gx, gz, level] of lodMissing) {
    if (lodBuilt >= LOD_BUDGET) break;
    const mesh = buildLODMesh(world, gx, gz, level);
    lodMeshes.set(key, mesh);
    scene.add(mesh);
    lodBuilt++;
  }
  for (const [key, mesh] of lodMeshes) {
    if (!wantLod.has(key)) {
      scene.remove(mesh); mesh.geometry.dispose(); lodMeshes.delete(key);
    }
  }
}
setInterval(chunkManagerTick, 250);