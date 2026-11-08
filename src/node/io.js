// Node helpers: load catalog/atlas/templates, read/write maps, save PNG renders.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import { renderMap } from '../core/render.js';
import { readMsav, writeMsav } from '../core/msav.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let cache;
export function assets() {
  if (cache) return cache;
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/catalog.json'), 'utf8'));
  const templates = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/templates.json'), 'utf8'));
  const png = PNG.sync.read(fs.readFileSync(path.join(ROOT, 'public/atlas.png')));
  const atlas = { width: png.width, height: png.height, data: png.data };
  return (cache = { catalog, templates, atlas });
}

export function loadMap(file) {
  return readMsav(fs.readFileSync(file));
}

export function saveMap(map, file) {
  const { templates } = assets();
  const sizes = Object.fromEntries(Object.entries(templates.buildings).map(([k, v]) => [k, { size: v.size }]));
  for (const [i, b] of map.buildings) if (!b.raw) b.raw = new Uint8Array(templates.buildings[map.block[i]].raw);
  fs.writeFileSync(file, writeMsav(map, templates.blocks, { ...sizes, emptyMarkers: new Uint8Array(templates.emptyMarkers) }));
}

export function savePng(map, file, opts = {}) {
  const { catalog, atlas } = assets();
  const img = renderMap(map, catalog, atlas, opts);
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data.buffer);
  fs.writeFileSync(file, PNG.sync.write(png));
}
