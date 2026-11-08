// Floor adjacency statistics across campaign maps -> data/adjacency.json
import fs from 'fs'; import path from 'path';
import { loadMap } from '../src/node/io.js';
const dir = process.argv[2] ?? '../Mindustry_map_editor-master/core/assets/maps/serpulo';
const pair = {}, total = {}, wallOn = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.msav'))) {
  const m = loadMap(path.join(dir, f)), W = m.width;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = m.floor[i];
    total[a] = (total[a] ?? 0) + 1;
    const b = m.block[i];
    if (b !== 'air' && b !== '@part') { wallOn[a] ??= {}; wallOn[a][b] = (wallOn[a][b] ?? 0) + 1; }
    for (const j of [x + 1 < W ? i + 1 : -1, y + 1 < m.height ? i + W : -1]) {
      if (j < 0) continue; const c = m.floor[j]; if (c === a) continue;
      const k = a < c ? a + '|' + c : c + '|' + a; pair[k] = (pair[k] ?? 0) + 1;
    }
  }
}
fs.writeFileSync('data/adjacency.json', JSON.stringify({ pair, total, wallOn }));
const top = Object.entries(pair).sort((a, b) => b[1] - a[1]).slice(0, 70);
console.log(top.map(([k, v]) => k + ' ' + v).join('\n'));
console.log('\nWALLS on floor:'); for (const [f, w] of Object.entries(wallOn).sort((a,b)=>total[b[0]]-total[a[0]]).slice(0,25)) console.log(f.padEnd(22), Object.entries(w).sort((a,b)=>b[1]-a[1]).slice(0,4).map(e=>e.join(':')).join(' '));
