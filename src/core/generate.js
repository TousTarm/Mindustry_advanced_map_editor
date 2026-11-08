// Turns a sketch (coarse labels + markers) into a detailed, natural-looking Mindustry map.
//
// Pipeline: domain-warp the sketch -> liquid depth + shore bands -> biome floors with nested noise patches
// -> rock clusters + cellular-automata smoothing -> guaranteed spawn->core paths -> boulders, trees, ores -> core/spawns.
// Every stage has its own seed so a single layer can be rerolled without changing the rest.
import { fbm, ridged, edt, rng, hashSeed } from './noise.js';
import { BIOMES, LIQUIDS, LABELS, WATER_MIX, ORES } from './palettes.js';

export const DEFAULT_PARAMS = {
  seed: 1,
  seeds: {}, // per-stage overrides: shape, floor, rocks, ores, deco
  warp: 9, // large-scale shape wobble (tiles)
  warpScale: 50,
  rough: 3, // small-scale edge raggedness (tiles)
  roughScale: 8,
  liquidWarp: 0.55, // liquids follow the sketch more closely (keeps rivers connected)
  dither: 1.6, // speckled blending between biomes (tiles)
  detail: 1, // amount of secondary floor patches (0 = flat biomes)
  shore: 1, // beach width multiplier
  rocks: 0.12, // interior rock cluster density 0..1
  rockScale: 24,
  rockMin: 60, // generated rock clusters smaller than this many tiles are removed (no scattered crumbs)
  smooth: 2, // cellular automata passes on walls
  border: 0, // extra wall thickness at the map edge (0 = none)
  boulders: 0.02,
  trees: 0.5,
  ores: 1,
  oresOn: true,
  deep: 1, // deep-liquid amount: 0 = only shallow, 1 = normal, 2 = deep sooner
  shores: { water: true, tainted: true, slag: true, tar: false, cryo: true }, // beach/transition bands per liquid
  startOres: true, // guarantee copper + lead near the core
  ensurePath: true,
  coreClear: 9,
};

const KIND = LABELS.map((l) => l.kind);
const KEY = LABELS.map((l) => l.key);

function quantile(values, mask, q) {
  const arr = [];
  for (let i = 0; i < values.length; i++) if (!mask || mask[i]) arr.push(values[i]);
  if (!arr.length) return Infinity;
  arr.sort((a, b) => a - b);
  return arr[Math.min(arr.length - 1, Math.max(0, Math.floor(q * arr.length)))];
}

/** Multi-source BFS: for every tile, the label of the nearest tile that passes `accept`. */
function nearestFill(W, H, labels, accept, fallback) {
  const out = new Uint8Array(W * H), seen = new Uint8Array(W * H), queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  for (let i = 0; i < W * H; i++) if (accept(labels[i], i)) { out[i] = labels[i]; seen[i] = 1; queue[tail++] = i; }
  if (!tail) return out.fill(fallback);
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j >= 0 && !seen[j]) { seen[j] = 1; out[j] = out[i]; queue[tail++] = j; }
    }
  }
  return out;
}

/** Grid A* returning the list of tile indices from a to b. */
function astar(W, H, cost, a, b) {
  const g = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const heap = [], bx = b % W, by = (b / W) | 0;
  const h = (i) => Math.hypot((i % W) - bx, ((i / W) | 0) - by);
  const push = (i, f) => { heap.push([f, i]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  g[a] = 0; push(a, h(a));
  while (heap.length) {
    const [, i] = pop();
    if (i === b) break;
    if (closed[i]) continue;
    closed[i] = 1;
    const x = i % W, y = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx, ng = g[i] + cost[j] * (dx && dy ? 1.414 : 1);
      if (ng < g[j]) { g[j] = ng; from[j] = i; push(j, ng + h(j)); }
    }
  }
  const path = [];
  for (let i = b; i >= 0; i = from[i]) { path.push(i); if (i === a) break; }
  return path.reverse();
}

export function generate(sketch, userParams = {}, catalog) {
  const P = { ...DEFAULT_PARAMS, ...userParams, seeds: { ...DEFAULT_PARAMS.seeds, ...(userParams.seeds ?? {}) }, shores: { ...DEFAULT_PARAMS.shores, ...(userParams.shores ?? {}) } };
  const seedOf = (stage) => P.seeds[stage] ?? hashSeed(P.seed, stage);
  const { width: W, height: H } = sketch, N = W * H;
  const CB = catalog.blocks;
  const baseId = LABELS.find((l) => l.key === sketch.base)?.id ?? LABELS.find((l) => l.key === 'stone').id;
  const idx = (x, y) => y * W + x;
  const cl = (v, max) => Math.max(0, Math.min(max, Math.round(v)));

  const raw = new Uint8Array(N);
  for (let i = 0; i < N; i++) raw[i] = sketch.labels[i] || baseId;
  // fixed tiles are used exactly as painted; relative tiles are hints that get warped and noised.
  // Relative tiles sample a grid where fixed shapes are replaced by their surroundings, so fixed shapes don't smear.
  const fixed = sketch.fixed && sketch.fixed.length === N ? sketch.fixed : null;
  const isFixed = (i) => fixed !== null && fixed[i] === 1;
  const rel = fixed ? nearestFill(W, H, raw, (l, i) => !fixed[i], baseId) : raw;
  const landFill = nearestFill(W, H, rel, (l) => KIND[l] === 'land', baseId);
  const solidFill = nearestFill(W, H, rel, (l) => KIND[l] !== 'liquid', baseId);
  const landFillAll = fixed ? nearestFill(W, H, raw, (l) => KIND[l] === 'land', baseId) : landFill;

  // ---- 1. domain warp ----
  const sShape = seedOf('shape');
  const wx1 = fbm(sShape + 1, { scale: P.warpScale, octaves: 3 }), wy1 = fbm(sShape + 2, { scale: P.warpScale, octaves: 3 });
  const wx2 = fbm(sShape + 3, { scale: P.roughScale, octaves: 3, persistence: 0.6 }), wy2 = fbm(sShape + 4, { scale: P.roughScale, octaves: 3, persistence: 0.6 });
  const dx3 = fbm(sShape + 5, { scale: 2.5, octaves: 2 }), dy3 = fbm(sShape + 6, { scale: 2.5, octaves: 2 });

  const shape = new Uint8Array(N), biome = new Uint8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const ax = wx1(x, y) * P.warp, ay = wy1(x, y) * P.warp, bx = wx2(x, y) * P.rough, by = wy2(x, y) * P.rough;
    const sx = cl(x + ax + bx, W - 1), sy = cl(y + ay + by, H - 1);
    const lx = cl(x + (ax + bx * 0.5) * P.liquidWarp, W - 1), ly = cl(y + (ay + by * 0.5) * P.liquidWarp, H - 1);
    if (isFixed(i)) {
      shape[i] = raw[i];
      biome[i] = KIND[raw[i]] === 'land' ? raw[i] : landFillAll[i];
      continue;
    }
    const lq = rel[idx(lx, ly)];
    // liquids and painted walls follow the sketch closely (thin rivers / wall lines stay connected and a later
    // stroke always wins); everything else uses the strong warp for organic outlines
    shape[i] = KIND[lq] === 'liquid' || KIND[lq] === 'wall' ? lq : solidFill[idx(sx, sy)];
    const fx = cl(x + ax + bx + dx3(x, y) * P.dither, W - 1), fy = cl(y + ay + by + dy3(x, y) * P.dither, H - 1);
    biome[i] = landFill[idx(fx, fy)];
  }

  // ---- 2. liquids: depth inside, distance outside per liquid type ----
  const isLiquid = (i) => KIND[shape[i]] === 'liquid';
  const depth = edt(W, H, (i) => !isLiquid(i));
  const liquidTypes = [...new Set([...shape].filter((l) => KIND[l] === 'liquid'))];
  const distOut = new Float32Array(N).fill(1e9), nearLiquid = new Uint8Array(N);
  for (const t of liquidTypes) {
    const d = edt(W, H, (i) => shape[i] === t);
    for (let i = 0; i < N; i++) if (d[i] < distOut[i]) { distOut[i] = d[i]; nearLiquid[i] = t; }
  }

  // ---- 3. floors ----
  const sFloor = seedOf('floor');
  const fields = new Map();
  const field = (key, scale) => {
    const k = key + ':' + scale;
    if (!fields.has(k)) {
      const n = fbm(hashSeed(sFloor, k), { scale, octaves: 4, persistence: 0.55 });
      const v = new Float32Array(N);
      for (let i = 0; i < N; i++) v[i] = n(i % W, (i / W) | 0);
      fields.set(k, v);
    }
    return fields.get(k);
  };
  const thresholds = new Map();
  const landMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) landMask[i] = isLiquid(i) ? 0 : 1;
  const thresholdFor = (key, scale, t) => {
    const k = key + ':' + scale + ':' + t;
    if (!thresholds.has(k)) thresholds.set(k, quantile(field(key, scale), landMask, 1 - (1 - t) * P.detail));
    return thresholds.get(k);
  };
  const shoreNoise = fbm(sFloor + 77, { scale: 18, octaves: 3 });
  const depthNoise = fbm(sFloor + 78, { scale: 14, octaves: 3 });

  const floor = new Array(N), overlay = new Array(N).fill('air'), block = new Array(N).fill('air');
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    const b = BIOMES[KEY[biome[i]]] ?? BIOMES.stone;
    if (isLiquid(i)) {
      const L = LIQUIDS[KEY[shape[i]]];
      const d = depth[i] + depthNoise(x, y) * 2.2;
      let f = L.inner[0].floor;
      for (const band of L.inner) if (band.depth === 0 || (P.deep > 0 && d >= band.depth / P.deep)) f = band.floor;
      floor[i] = f;
      continue;
    }
    let f = b.base;
    // a layer only paints onto the base floor or onto its own nested chain (same noise field), so patches never
    // punch holes into each other - a sand patch stays one continuous piece
    if (P.detail > 0) {
      let owner = null;
      for (const layer of b.layers) {
        if (owner !== null && owner !== layer.noise) continue;
        if (field(layer.noise, layer.scale)[i] > thresholdFor(layer.noise, layer.scale, layer.threshold)) { f = layer.floor; owner = layer.noise; }
      }
    }
    if (nearLiquid[i] && P.shores?.[KEY[nearLiquid[i]]] !== false) {
      const L = LIQUIDS[KEY[nearLiquid[i]]];
      const mod = Math.max(0.25, 1 + 0.75 * shoreNoise(x, y)) * P.shore;
      let acc = 0;
      for (const band of L.shore) {
        acc += band.width * mod;
        if (distOut[i] <= acc) {
          f = band.floor === 'beach' ? b.beach : band.floor === 'mix' ? WATER_MIX[b.beach] ?? WATER_MIX.default : band.floor;
          break;
        }
      }
    }
    floor[i] = f;
  }

  // ---- 4. walls ----
  const sRocks = seedOf('rocks');
  let wall = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const k = KIND[shape[i]];
    if (k === 'wall') wall[i] = 1;
    if (k === 'void') floor[i] = 'empty';
  }
  const sketchWall = wall.slice();
  const fixedWall = new Uint8Array(N);
  for (let i = 0; i < N; i++) fixedWall[i] = sketchWall[i] && isFixed(i) ? 1 : 0;
  if (P.rocks > 0) {
    const rn = fbm(sRocks, { scale: P.rockScale, octaves: 3, persistence: 0.5 });
    const rr = ridged(sRocks + 9, { scale: P.rockScale * 2.2, octaves: 3 });
    const rv = new Float32Array(N), mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      rv[i] = rn(x, y) + 0.2 * rr(x, y) ** 6;
      mask[i] = !isLiquid(i) && !wall[i] && !isFixed(i) && KIND[shape[i]] !== 'void' ? 1 : 0;
    }
    const t = quantile(rv, mask, 1 - P.rocks * 0.5);
    for (let i = 0; i < N; i++) if (mask[i] && rv[i] > t && distOut[i] > 1.5) wall[i] = 1;
  }
  if (P.border > 0) {
    const bn = fbm(sRocks + 31, { scale: 10, octaves: 2 });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (e < P.border * (1 + 0.6 * bn(x, y)) && !isFixed(idx(x, y))) wall[idx(x, y)] = 1;
    }
  }
  for (let it = 0; it < P.smooth; it++) {
    const next = wall.slice();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (isFixed(i)) { next[i] = wall[i]; continue; } // fixed tiles never change
      if (isLiquid(i)) { next[i] = 0; continue; }
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        n += nx < 0 || ny < 0 || nx >= W || ny >= H ? wall[i] : wall[idx(nx, ny)]; // outside the map mirrors the tile itself
      }
      if (n >= 5) next[i] = 1; else if (n <= 2) next[i] = 0;
    }
    wall = next;
  }
  // drop small generated rock clusters; sketched walls and fixed tiles are kept
  const dropSmallRocks = () => {
    if (!(P.rockMin > 0)) return;
    const seen = new Uint8Array(N), stack = [], comp = [];
    const gen = (i) => wall[i] && !sketchWall[i] && !isFixed(i);
    for (let s = 0; s < N; s++) {
      if (seen[s] || !gen(s)) continue;
      comp.length = 0; stack.push(s); seen[s] = 1;
      while (stack.length) {
        const i = stack.pop(), x = i % W;
        comp.push(i);
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
          if (j >= 0 && j < N && !seen[j] && gen(j)) { seen[j] = 1; stack.push(j); }
        }
      }
      if (comp.length < P.rockMin) for (const i of comp) wall[i] = 0;
    }
  };
  dropSmallRocks();

  // ---- 5. protected zones and guaranteed paths ----
  const sDeco = seedOf('deco');
  const R = rng(sDeco);
  const clearNoise = fbm(sDeco + 5, { scale: 6, octaves: 2 });
  const protectedMask = new Uint8Array(N);
  const cores = (sketch.cores?.length ? sketch.cores : sketch.core ? [{ pos: sketch.core, team: 1, block: sketch.coreBlock }] : [])
    .map((c) => ({ pos: c.pos, team: c.team ?? 1, block: c.block ?? 'core-shard' }));
  const core = cores.find((c) => c.team === 1)?.pos ?? cores[0]?.pos;
  const coreSize = CB[cores[0]?.block]?.size ?? 3;
  const clearCircle = (cx, cy, r) => {
    for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y++) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = idx(x, y);
      if (Math.hypot(x - cx, y - cy) <= r * (1 + 0.3 * clearNoise(x, y))) {
        wall[i] = 0; protectedMask[i] = 1;
        if (isLiquid(i) || floor[i] === 'empty') floor[i] = (BIOMES[KEY[biome[i]]] ?? BIOMES.stone).base;
      }
    }
  };
  for (const c of cores) clearCircle(c.pos[0], c.pos[1], P.coreClear + (CB[c.block]?.size ?? 3) / 2);
  for (const s of sketch.spawns) clearCircle(s[0], s[1], 5);

  if (P.ensurePath && core) {
    const cost = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const deep = CB[floor[i]]?.deep;
      cost[i] = fixedWall[i] ? 300 : floor[i] === 'empty' ? 60 : wall[i] ? 14 : deep ? 10 : 1;
    }
    const pathNoise = fbm(sDeco + 6, { scale: 12, octaves: 2 });
    const targets = [...sketch.spawns.map((s) => [s, core]), ...cores.filter((c) => c.pos !== core).map((c) => [c.pos, core])];
    for (const [s, goal] of targets) {
      const core = goal;
      const path = astar(W, H, cost, idx(cl(s[0], W - 1), cl(s[1], H - 1)), idx(cl(core[0], W - 1), cl(core[1], H - 1)));
      for (const p of path) {
        const px = p % W, py = (p / W) | 0;
        const blocked = wall[p] || CB[floor[p]]?.deep || floor[p] === 'empty';
        if (!blocked) continue;
        const r = 2.5 + 1.5 * pathNoise(px, py);
        for (let y = Math.floor(py - r); y <= py + r; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
          if (x < 0 || y < 0 || x >= W || y >= H || Math.hypot(x - px, y - py) > r) continue;
          const i = idx(x, y);
          wall[i] = 0;
          if (CB[floor[i]]?.deep && isLiquid(i)) floor[i] = LIQUIDS[KEY[shape[i]]].inner[0].floor;
          if (CB[floor[i]]?.deep || floor[i] === 'empty') floor[i] = (BIOMES[KEY[biome[i]]] ?? BIOMES.stone).base;
        }
      }
    }
  }

  dropSmallRocks(); // path carving can leave crumbs behind

  for (let i = 0; i < N; i++) {
    if (!wall[i]) continue;
    const b = BIOMES[KEY[biome[i]]] ?? BIOMES.stone;
    block[i] = b.wall ?? CB[floor[i]]?.wall ?? 'stone-wall';
  }

  // ---- 6. boulders and trees ----
  const dWall = edt(W, H, (i) => wall[i]);
  const treeNoise = fbm(sDeco + 7, { scale: 9, octaves: 3 });
  for (let i = 0; i < N; i++) {
    if (wall[i] || protectedMask[i] || CB[floor[i]]?.liquid || floor[i] === 'empty') continue;
    const x = i % W, y = (i / W) | 0;
    const b = BIOMES[KEY[biome[i]]] ?? BIOMES.stone;
    if (b.tree && P.trees > 0 && treeNoise(x, y) > 0.42 - P.trees * 0.12 && dWall[i] < 9 && R() < 0.35) { block[i] = b.tree; continue; }
    const deco = CB[floor[i]]?.decoration;
    if (deco && R() < P.boulders * (1 + 4 * Math.exp(-dWall[i] / 2.5))) block[i] = deco;
  }

  // ---- 7. ores ----
  const sOres = seedOf('ores');
  const diag = Math.hypot(W, H);
  const dCore = core ? edt(W, H, (i) => i === idx(cl(core[0], W - 1), cl(core[1], H - 1))) : null;
  const oreOk = (i) => block[i] === 'air' && !CB[floor[i]]?.liquid && floor[i] !== 'empty' && !protectedMask[i];
  const oreMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) oreMask[i] = oreOk(i) ? 1 : 0;
  if (P.oresOn !== false && P.ores > 0) for (const [ore, o] of Object.entries(ORES)) {
    const n = fbm(hashSeed(sOres, ore), { scale: o.scale, octaves: 3, persistence: 0.35 });
    const sc = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (!oreMask[i]) { sc[i] = -9; continue; }
      const x = i % W, y = (i / W) | 0;
      const dist = dCore ? dCore[i] / diag : 0.4;
      sc[i] = n(x, y) + 0.3 * Math.exp(-((dist - o.near) ** 2) / 0.04) + 0.15 * Math.exp(-dWall[i] / 4);
    }
    const t = quantile(sc, oreMask, 1 - o.coverage * P.ores);
    const hit = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (oreMask[i] && sc[i] > t) hit[i] = 1;
    // drop isolated specks so veins read as solid deposits
    for (let i = 0; i < N; i++) {
      if (!hit[i]) continue;
      const x = i % W, y = (i / W) | 0;
      let n4 = 0;
      if (x > 0) n4 += hit[i - 1]; if (x < W - 1) n4 += hit[i + 1]; if (y > 0) n4 += hit[i - W]; if (y < H - 1) n4 += hit[i + W];
      if (n4 >= 2) overlay[i] = ore;
    }
  }
  const oreSpot = (ore, cx, cy, r) => {
    const n = fbm(hashSeed(sOres, ore, cx, cy), { scale: Math.max(3, r * 0.6), octaves: 2 });
    for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = idx(x, y), d = Math.hypot(x - cx, y - cy) / r;
      if (d <= 1 && n(x, y) > d * d - 0.35 && block[i] === 'air' && !CB[floor[i]]?.liquid && floor[i] !== 'empty') overlay[i] = ore;
    }
  };
  for (const s of sketch.ores ?? []) oreSpot(s.ore, s.center[0], s.center[1], s.r ?? 5);
  if (P.oresOn !== false && P.startOres && core) {
    for (const ore of ['ore-copper', 'ore-lead', 'ore-copper']) {
      for (let tries = 0; tries < 40; tries++) {
        const a = R() * Math.PI * 2, d = P.coreClear + coreSize + 3 + R() * 10;
        const x = Math.round(core[0] + Math.cos(a) * d), y = Math.round(core[1] + Math.sin(a) * d);
        if (x < 4 || y < 4 || x >= W - 4 || y >= H - 4) continue;
        const i = idx(x, y);
        if (wall[i] || CB[floor[i]]?.liquid) continue;
        oreSpot(ore, x, y, 3.5 + R() * 2);
        break;
      }
    }
  }

  // ---- 8. core and spawns ----
  const buildings = new Map();
  for (const c of cores) {
    const size = CB[c.block]?.size ?? 3;
    const cx = cl(c.pos[0], W - 1), cy = cl(c.pos[1], H - 1), ci = idx(cx, cy);
    const off = Math.floor((size - 1) / 2);
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const x = cx - off + dx, y = cy - off + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = idx(x, y);
      block[i] = '@part'; overlay[i] = 'air';
    }
    block[ci] = c.block;
    buildings.set(ci, { team: c.team });
  }
  for (const s of sketch.spawns) {
    const i = idx(cl(s[0], W - 1), cl(s[1], H - 1));
    overlay[i] = 'spawn'; block[i] = 'air';
  }

  return {
    width: W, height: H, floor, overlay, block, buildings,
    tags: { name: sketch.name ?? 'Mindscape map', author: sketch.author ?? '', description: sketch.description ?? '', rules: JSON.stringify(sketch.rules ?? {}), genfilters: '[]' },
    params: P,
  };
}
