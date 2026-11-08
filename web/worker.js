// Runs the generator off the main thread. Tiles are sent back as Uint16 ids into `names`.
import { generate } from '../src/core/generate.js';
import catalog from '../data/catalog.json';

const names = ['air', '@part', ...Object.keys(catalog.blocks).filter((n) => n !== 'air')];
const ids = new Map(names.map((n, i) => [n, i]));

self.onmessage = (e) => {
  const { id, sketch, params } = e.data;
  try {
    const t0 = performance.now();
    const map = generate(sketch, params, catalog);
    const N = map.width * map.height;
    const floor = new Uint16Array(N), overlay = new Uint16Array(N), block = new Uint16Array(N);
    for (let i = 0; i < N; i++) { floor[i] = ids.get(map.floor[i]); overlay[i] = ids.get(map.overlay[i]); block[i] = ids.get(map.block[i]); }
    self.postMessage({
      id, names, width: map.width, height: map.height, floor, overlay, block,
      buildings: [...map.buildings].map(([i, b]) => [i, b.team]), tags: map.tags, ms: performance.now() - t0,
    }, [floor.buffer, overlay.buffer, block.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err.stack ?? err) });
  }
};
