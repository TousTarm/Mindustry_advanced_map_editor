#!/usr/bin/env node
// Mindscape CLI. Run `node src/cli.js help`.
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { assets, loadMap, saveMap, savePng } from './node/io.js';
import { rasterizeSpec } from './core/sketch.js';
import { generate, DEFAULT_PARAMS } from './core/generate.js';
import { LABELS, BIOMES, LIQUIDS } from './core/palettes.js';
import { deriveSketch, sketchToSpec } from './core/project.js';
import { readMsav } from './core/msav.js';
import { imageToLabels } from './core/imagesketch.js';
import { rleEncode } from './core/project.js';
import { ROOT } from './node/io.js';

const BRIDGE = path.join(ROOT, '.mindscape');

const HELP = `mindscape - Mindustry map generator and tools

  gen <spec.json> [-o out.msav] [--png out.png] [--scale N] [--seed N] [--set key=value ...]
      Generate a map from a sketch spec. --set overrides generator params (e.g. --set rocks=0.4).
  sketch <spec.json> [-o sketch.png] [--scale N]
      Render just the coarse sketch layout (to check shapes before generating).
  render <map.msav> [-o out.png] [--scale N]
      Render any .msav map (sprite mode at scale >= 4, flat colors below).
  info <map.msav>
      Size, tags and floor/block histogram of a map.
  beautify <map.msav> [-o out.msav] [--generalize N] [--seed N] [--set key=value ...]
      Derive a coarse sketch from an existing map and regenerate it with natural detail.
      Also writes <out>.spec.json (editable sketch) and <out>.png.
  derive <map.msav> [-o spec.json] [--generalize N]
      Only derive the sketch spec from a map (to edit it by hand, then use gen).
  push <spec.json|project.mindscape.json|map.msav> [--note "text"]
      Send a design to the running web editor (npm run dev); it offers to load it.
  pull [-o dir]
      Fetch what the editor sent with "→ Claude": writes outbox.spec.json, outbox.msav, outbox.png, outbox.sketch.png.
  image <drawing.png> --width N [--height N] [-o spec.json] [--close N] [--line N] [--base biome]
      Turn a hand-drawn sketch image into a spec: red strokes become walls, the outside of the outline
      becomes wall, small closed loops become rocks. Height defaults to the image aspect ratio.
  labels
      List sketch labels (biomes, liquids), default params and spec format.
`;

function args(argv) {
  const out = { _: [], set: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--set') { const [k, v] = argv[++i].split('='); out.set[k] = isNaN(+v) ? (v === 'true' ? true : v === 'false' ? false : v) : +v; }
    else if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
    else if (a === '-o') out.o = argv[++i];
    else out._.push(a);
  }
  return out;
}

function hist(arr) {
  const h = {};
  for (const v of arr) h[v] = (h[v] ?? 0) + 1;
  return Object.entries(h).sort((a, b) => b[1] - a[1]);
}

function sketchPng(sk, file, scale) {
  const png = new PNG({ width: sk.width * scale, height: sk.height * scale });
  const colors = LABELS.map((l) => [1, 3, 5].map((k) => parseInt(l.color.slice(k, k + 2), 16)));
  const base = colors[LABELS.find((l) => l.key === sk.base).id];
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const tx = Math.floor(x / scale), ty = sk.height - 1 - Math.floor(y / scale);
    const l = sk.labels[ty * sk.width + tx];
    const c = l ? colors[l] : base, o = (y * png.width + x) * 4;
    png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
  }
  const mark = (p, rgb, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = Math.round(p[0] * scale + dx), y = Math.round((sk.height - 1 - p[1]) * scale + dy);
      if (x < 0 || y < 0 || x >= png.width || y >= png.height) continue;
      const o = (y * png.width + x) * 4; png.data[o] = rgb[0]; png.data[o + 1] = rgb[1]; png.data[o + 2] = rgb[2];
    }
  };
  for (const c of sk.cores) mark(c.pos, [255, 211, 127], scale * 2);
  for (const s of sk.spawns) mark(s, [243, 94, 82], scale * 2);
  for (const o of sk.ores) mark(o.center, [200, 200, 255], scale);
  fs.writeFileSync(file, PNG.sync.write(png));
}

const a = args(process.argv.slice(2));
const cmd = a._[0];
const scale = a.scale ? +a.scale : undefined;

switch (cmd) {
  case 'gen': {
    const spec = JSON.parse(fs.readFileSync(a._[1], 'utf8'));
    const params = { seed: spec.seed ?? 1, ...(spec.params ?? {}), ...a.set };
    if (a.seed) params.seed = +a.seed;
    const sk = rasterizeSpec(spec);
    const t0 = Date.now();
    const map = generate(sk, params, assets().catalog);
    const out = a.o ?? a._[1].replace(/\.json$/, '.msav');
    saveMap(map, out);
    const png = a.png ?? out.replace(/\.msav$/, '.png');
    savePng(map, png, { scale: scale ?? (map.width > 300 ? 2 : 4) });
    console.log(`generated ${map.width}x${map.height} in ${Date.now() - t0}ms -> ${out}, ${png} (seed ${map.params.seed})`);
    break;
  }
  case 'sketch': {
    const spec = JSON.parse(fs.readFileSync(a._[1], 'utf8'));
    const out = a.o ?? a._[1].replace(/\.json$/, '.sketch.png');
    sketchPng(rasterizeSpec(spec), out, scale ?? 3);
    console.log('->', out);
    break;
  }
  case 'render': {
    const map = loadMap(a._[1]);
    const out = a.o ?? a._[1].replace(/\.msav$/, '.png');
    savePng(map, out, { scale: scale ?? 4 });
    console.log('->', out);
    break;
  }
  case 'info': {
    const map = loadMap(a._[1]);
    console.log(`${path.basename(a._[1])}: ${map.width}x${map.height}, save v${map.version}`);
    for (const k of ['name', 'author', 'description']) if (map.tags[k]) console.log(`  ${k}: ${map.tags[k]}`);
    const N = map.width * map.height;
    const fmt = (h) => h.slice(0, 15).map(([k, v]) => `${k} ${(100 * v / N).toFixed(1)}%`).join(', ');
    console.log('  floors:', fmt(hist(map.floor)));
    console.log('  overlays:', fmt(hist(map.overlay).filter(([k]) => k !== 'air')));
    console.log('  blocks:', fmt(hist(map.block).filter(([k]) => k !== 'air' && k !== '@part')));
    console.log('  buildings:', map.buildings.size);
    break;
  }
  case 'beautify': {
    const src = loadMap(a._[1]);
    const sk = deriveSketch(src, assets().catalog, { generalize: a.generalize ? +a.generalize : 2 });
    const params = { seed: a.seed ? +a.seed : 1, ...a.set };
    const map = generate(sk, params, assets().catalog);
    const out = a.o ?? a._[1].replace(/\.msav$/, '.beautified.msav');
    saveMap(map, out);
    savePng(map, out.replace(/\.msav$/, '.png'), { scale: scale ?? (map.width > 300 ? 2 : 4) });
    fs.writeFileSync(out.replace(/\.msav$/, '.spec.json'), JSON.stringify(sketchToSpec(sk, { name: sk.name, author: sk.author, seed: params.seed, params: a.set })));
    console.log(`beautified ${map.width}x${map.height} -> ${out} (+ .png, .spec.json)`);
    break;
  }
  case 'derive': {
    const src = loadMap(a._[1]);
    const sk = deriveSketch(src, assets().catalog, { generalize: a.generalize ? +a.generalize : 2 });
    const out = a.o ?? a._[1].replace(/\.msav$/, '.spec.json');
    fs.writeFileSync(out, JSON.stringify(sketchToSpec(sk, { name: sk.name, author: sk.author })));
    console.log('->', out);
    break;
  }
  case 'push': {
    const f = a._[1];
    fs.mkdirSync(BRIDGE, { recursive: true });
    let msg;
    if (f.endsWith('.msav')) msg = { type: 'msav', name: path.basename(f, '.msav'), msavBase64: fs.readFileSync(f).toString('base64') };
    else {
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      msg = (j.format === 'mindscape-project' || j.format === 'mapforge-project') ? { type: 'project', project: j } : { type: 'spec', spec: j };
    }
    if (a.note) msg.note = a.note;
    fs.writeFileSync(path.join(BRIDGE, 'inbox.json'), JSON.stringify(msg));
    console.log(`pushed ${msg.type} to the editor inbox`);
    break;
  }
  case 'pull': {
    const dir = a.o ?? BRIDGE;
    const jf = path.join(BRIDGE, 'outbox.json');
    if (!fs.existsSync(jf)) { console.log('nothing in outbox - press "→ Claude" in the editor first'); break; }
    const p = JSON.parse(fs.readFileSync(jf, 'utf8'));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'outbox.spec.json'), JSON.stringify({ ...p.spec, seed: p.params?.seed, params: p.params }, null, 0));
    sketchPng(rasterizeSpec(p.spec), path.join(dir, 'outbox.sketch.png'), 3);
    const mf = path.join(BRIDGE, 'outbox.msav');
    if (fs.existsSync(mf)) {
      if (dir !== BRIDGE) fs.copyFileSync(mf, path.join(dir, 'outbox.msav'));
      const map = readMsav(fs.readFileSync(mf));
      savePng(map, path.join(dir, 'outbox.png'), { scale: scale ?? (map.width > 300 ? 2 : 4) });
    }
    console.log(`sent ${p.sentAt}: "${p.spec.name ?? ''}" ${p.spec.width}x${p.spec.height}, ${p.spec.cores?.length ?? 0} cores, ${p.spec.spawns?.length ?? 0} spawns, ${p.locks?.length ?? 0} locked tiles, seed ${p.params?.seed}`);
    console.log('files in', dir, ': outbox.spec.json, outbox.sketch.png' + (fs.existsSync(mf) ? ', outbox.msav, outbox.png' : ''));
    break;
  }
  case 'image': {
    const png = PNG.sync.read(fs.readFileSync(a._[1]));
    const W = +(a.width ?? 200), H = +(a.height ?? Math.round((W * png.height) / png.width));
    const labels = imageToLabels(png.data, png.width, png.height, W, H, {
      ...(a.close ? { closeGaps: +a.close } : {}), ...(a.line ? { lineWidth: +a.line } : {}),
    });
    const spec = { name: path.basename(a._[1]).replace(/\.\w+$/, ''), width: W, height: H, base: a.base ?? 'stone', labelsRLE: rleEncode(labels), cores: [], spawns: [], params: { rocks: 0 } }; // only the drawn walls, no random rocks
    const out = a.o ?? a._[1].replace(/\.\w+$/, '.spec.json');
    fs.writeFileSync(out, JSON.stringify(spec));
    sketchPng(rasterizeSpec(spec), out.replace(/\.json$/, '.sketch.png'), 2);
    console.log(`${W}x${H} -> ${out} (+ .sketch.png)`);
    break;
  }
  case 'labels': {
    console.log('land biomes:', Object.keys(BIOMES).join(', '));
    console.log('liquids:', Object.keys(LIQUIDS).join(', '));
    console.log('other: wall, void');
    console.log('params:', JSON.stringify(DEFAULT_PARAMS, null, 1));
    console.log(`spec: { width, height, base: "<biome>", seed, params: {...},
  shapes: [ {type:"fill"|"rect"|"circle"|"ellipse"|"polygon"|"path", label, fixed?: true (exact, never changed by noise), center:[x,y], r, rx, ry, rect:[x,y,w,h], points:[[x,y]...], width: n | [start,end]} ],
  core: [x,y], coreBlock: "core-shard", spawns: [[x,y]], ores: [{ore:"ore-titanium", center:[x,y], r}] }
  Coordinates are tiles with y pointing up (0,0 = bottom-left), like in Mindustry. Later shapes paint over earlier ones.`);
    break;
  }
  default:
    console.log(HELP);
}
