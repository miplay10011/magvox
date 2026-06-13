// chunkWorker.js
importScripts('https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js');
// здесь нужно импортировать buildChunkMesh и World, но в воркере нет DOM.
// Проще будет передавать уже готовые блоки, а меш строить здесь.