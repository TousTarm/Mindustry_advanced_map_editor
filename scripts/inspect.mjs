import fs from 'fs'; import path from 'path';
import { readMsav } from '../src/core/msav.js';
const dirs = ['../Mindustry_map_editor-master/core/assets/maps/serpulo','../Mindustry_map_editor-master/core/assets/maps/default'];
for (const d of dirs) for (const f of fs.readdirSync(d).filter(f=>f.endsWith('.msav'))) {
  try {
    const m = readMsav(fs.readFileSync(path.join(d,f)));
    const blds = [...m.buildings.entries()].map(([i,b])=>m.block[i]+':'+b.team);
    console.log(f.padEnd(28), 'v'+m.version, m.width+'x'+m.height, 'bld', blds.length, [...new Set(blds)].slice(0,4).join(','));
  } catch (e) { console.log(f, 'ERR', e.message); }
}
