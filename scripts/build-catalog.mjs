// Builds data/catalog.json (block kinds, sizes, colors, wall/decoration links) and public/atlas.png
// from the Mindustry source tree. Usage: node scripts/build-catalog.mjs [path/to/Mindustry]
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const root = process.argv[2] ?? '../Mindustry_map_editor-master';
const src = fs.readFileSync(path.join(root, 'core/src/mindustry/content/Blocks.java'), 'utf8');
const spriteRoot = path.join(root, 'core/assets-raw/sprites/blocks');

const KIND = {
  Floor: 'floor', ShallowLiquid: 'floor', SteamVent: 'floor', EmptyFloor: 'floor',
  OverlayFloor: 'overlay', OreBlock: 'overlay', SpawnBlock: 'overlay',
  StaticWall: 'wall', StaticTree: 'wall', TreeBlock: 'wall',
  Prop: 'prop', StaticProp: 'prop', SeaBush: 'prop', Seaweed: 'prop', TallBlock: 'prop',
  AirBlock: 'air',
};

// declarations: var = new Class("name" ... ){{ body }};   or  new OreBlock(Items.copper)
const decl = /^ {8}(\w+) = new (\w+)\((?:"([\w-]+)"|Items\.(\w+))[^\n]*?\)(\{\{([\s\S]*?)\n {8}\}\})?;/gm;
const blocks = {};
const varToName = {};
let m;
while ((m = decl.exec(src))) {
  const [, v, cls, nameStr, item, , body = ''] = m;
  const name = nameStr ?? (cls === 'OreBlock' ? 'ore-' + item : null);
  if (!name) continue;
  varToName[v] = name;
  const b = { kind: KIND[cls] ?? 'building', cls };
  const size = body.match(/\bsize = (\d+);/);
  if (size) b.size = +size[1];
  if (/isLiquid = true/.test(body)) b.liquid = true;
  if (/drownTime = /.test(body)) b.deep = true;
  if (cls === 'ShallowLiquid') b.liquid = true;
  b._body = body;
  blocks[name] = b;
}
// fix "Items.x" names that differ (e.g. oreCrystalThorium declares its own name) - handled by regex above.

// wall / decoration links: inside block X's body, "a.asFloor().wall = b.asFloor().wall = this"
for (const [name, b] of Object.entries(blocks)) {
  for (const prop of ['wall', 'decoration']) {
    const re = new RegExp(`((?:\\w+\\.asFloor\\(\\)\\.${prop} = )+)this`, 'g');
    let mm;
    while ((mm = re.exec(b._body))) {
      for (const vm of mm[1].matchAll(new RegExp(`(\\w+)\\.asFloor\\(\\)\\.${prop}`, 'g'))) {
        const target = blocks[varToName[vm[1]]];
        if (target) target[prop] = name;
      }
    }
  }
  const blend = b._body.match(/blendGroup = (\w+);/);
  if (blend && varToName[blend[1]]) b.blend = varToName[blend[1]];
  delete b._body;
}
// ShallowLiquid sets: ((ShallowLiquid)darksandWater).set(Blocks.water, Blocks.darksand);
for (const mm of src.matchAll(/\(\(ShallowLiquid\)(\w+)\)\.set\(Blocks\.(\w+), Blocks\.(\w+)\)/g)) {
  const b = blocks[varToName[mm[1]]];
  if (b) b.mix = [varToName[mm[2]], varToName[mm[3]]];
}

// ---- sprites ----
const spriteFiles = new Map();
(function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.png')) spriteFiles.set(f.name.slice(0, -4), p);
  }
})(spriteRoot);

function spritesFor(name, kind) {
  const out = [];
  for (let i = 1; i <= 8; i++) if (spriteFiles.has(name + i)) out.push(spriteFiles.get(name + i));
  if (!out.length && spriteFiles.has(name)) out.push(spriteFiles.get(name));
  if (!out.length && kind === 'building') {
    for (const alt of [name + '-full', name + '-icon']) if (spriteFiles.has(alt)) { out.push(spriteFiles.get(alt)); break; }
  }
  return out;
}

// atlas: every sprite resized to TILE x TILE per tile of block size
const TILE = 16;
const entries = [];
for (const [name, b] of Object.entries(blocks)) {
  if (b.kind === 'air') continue;
  const files = spritesFor(name, b.kind);
  if (!files.length) continue;
  b.sprites = [];
  for (const f of files) entries.push({ name, b, png: PNG.sync.read(fs.readFileSync(f)) });
}

const cols = 64;
let cx = 0, cy = 0, rowH = 0;
const placed = [];
for (const e of entries) {
  const s = (e.b.size ?? 1) * TILE;
  if (cx + s > cols * TILE) { cx = 0; cy += rowH; rowH = 0; }
  placed.push({ ...e, x: cx, y: cy, s });
  cx += s; rowH = Math.max(rowH, s);
}
const atlas = new PNG({ width: cols * TILE, height: cy + rowH });
for (const p of placed) {
  const { png, s } = p;
  let r = 0, g = 0, bl = 0, n = 0;
  // box-filter downscale
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const x0 = Math.floor((x * png.width) / s), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * png.width) / s));
    const y0 = Math.floor((y * png.height) / s), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * png.height) / s));
    let acc = [0, 0, 0, 0], cnt = 0;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = (yy * png.width + xx) * 4;
      const a = png.data[i + 3] / 255;
      acc[0] += png.data[i] * a; acc[1] += png.data[i + 1] * a; acc[2] += png.data[i + 2] * a; acc[3] += png.data[i + 3]; cnt++;
    }
    const a = acc[3] / cnt, o = ((p.y + y) * atlas.width + p.x + x) * 4;
    const k = a > 0 ? 255 / acc[3] : 0;
    atlas.data[o] = acc[0] * k; atlas.data[o + 1] = acc[1] * k; atlas.data[o + 2] = acc[2] * k; atlas.data[o + 3] = a;
    if (a > 128) { r += atlas.data[o]; g += atlas.data[o + 1]; bl += atlas.data[o + 2]; n++; }
  }
  p.b.sprites.push([p.x, p.y]);
  if (!p.b.color && n) p.b.color = [r / n, g / n, bl / n].map(Math.round);
}

fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/atlas.png', PNG.sync.write(atlas));
fs.writeFileSync('data/catalog.json', JSON.stringify({ tile: TILE, blocks }, null, 0));
const count = (k) => Object.values(blocks).filter((b) => b.kind === k).length;
console.log(`catalog: ${Object.keys(blocks).length} blocks (floor ${count('floor')}, wall ${count('wall')}, overlay ${count('overlay')}, prop ${count('prop')}); atlas ${atlas.width}x${atlas.height}`);
