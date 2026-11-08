// Extracts data the writer needs from bundled campaign maps: block name list, core building bytes, empty markers chunk.
import fs from 'fs'; import path from 'path';
import { readMsav } from '../src/core/msav.js';
const root = process.argv[2] ?? '../Mindustry_map_editor-master/core/assets/maps';
const names = new Set(); const cores = {}; let markers = null;
for (const sub of ['serpulo', 'default']) {
  const d = path.join(root, sub);
  for (const f of fs.readdirSync(d).filter((f) => f.endsWith('.msav'))) {
    let m; try { m = readMsav(fs.readFileSync(path.join(d, f))); } catch { continue; }
    if (m.version >= 11) {
      m.contentNames[1].forEach((n) => names.add(n));
      for (const [i, b] of m.buildings) {
        const bn = m.block[i];
        if (bn.startsWith('core-') && b.raw.length < 200 && (!cores[bn] || b.raw.length < cores[bn].length)) cores[bn] = b.raw;
      }
    }
  }
}
const sizes = { 'core-shard': 3, 'core-foundation': 4, 'core-nucleus': 5 };
const out = {
  blocks: [...names],
  emptyMarkers: [0x7b, 0x7d],
  buildings: Object.fromEntries(Object.entries(cores).filter(([k]) => sizes[k]).map(([k, v]) => [k, { size: sizes[k], raw: [...v] }])),
};
fs.writeFileSync('data/templates.json', JSON.stringify(out));
console.log(out.blocks.length, 'blocks;', Object.entries(out.buildings).map(([k, v]) => k + ':' + v.raw.length).join(' '));
