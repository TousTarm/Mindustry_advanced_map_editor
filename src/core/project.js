// Project = sketch + generator params + locked tiles. Shared by the web editor, the CLI and the dev-server API.
import { LABELS, LABEL, BIOMES, LIQUIDS } from './palettes.js';
import { emptySketch } from './sketch.js';

export function rleEncode(arr) {
  const out = [];
  for (let i = 0; i < arr.length;) {
    let j = i;
    while (j < arr.length && arr[j] === arr[i]) j++;
    out.push(j - i === 1 ? `${arr[i]}` : `${arr[i]}*${j - i}`);
    i = j;
  }
  return out.join(',');
}

export function rleDecode(str, length) {
  const out = new Uint8Array(length);
  let p = 0;
  for (const part of str.split(',')) {
    const [v, n = 1] = part.split('*').map(Number);
    out.fill(v, p, p + n);
    p += n;
  }
  return out;
}

/** Sketch -> JSON-friendly spec (labels stored as RLE, markers kept). */
export function sketchToSpec(sk, extra = {}) {
  return {
    width: sk.width, height: sk.height, base: sk.base,
    labelsRLE: rleEncode(sk.labels),
    ...(sk.fixed?.some((v) => v) ? { fixedRLE: rleEncode(sk.fixed) } : {}),
    cores: sk.cores ?? [], spawns: sk.spawns ?? [], ores: sk.ores ?? [],
    ...extra,
  };
}

// floor -> label key, built from the palettes (base floors win over patch floors)
const FLOOR_LABEL = (() => {
  const m = {};
  for (const [k, l] of Object.entries(LIQUIDS)) for (const b of l.inner) m[b.floor] ??= k;
  for (const [k, b] of Object.entries(BIOMES)) m[b.base] ??= k;
  for (const [k, b] of Object.entries(BIOMES)) for (const l of b.layers) m[l.floor] ??= k;
  Object.assign(m, {
    'sand-water': 'water', 'darksand-water': 'water', 'darksand-tainted-water': 'tainted',
    'crater-stone': 'stone', char: 'stone', hotrock: 'basalt', magmarock: 'basalt', 'ice-snow': 'snow',
    'metal-floor': 'stone', 'metal-floor-damaged': 'stone', 'dark-panel-3': 'stone', dacite: 'stone',
  });
  return m;
})();

/**
 * Derive a coarse sketch from an existing map so it can be regenerated with natural detail
 * ("beautify"). `generalize` = radius of the majority filter that removes small details.
 */
export function deriveSketch(map, catalog, { generalize = 2, base } = {}) {
  const { width: W, height: H } = map, N = W * H, B = catalog.blocks;
  const counts = {};
  const labels = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const b = map.block[i], f = map.floor[i];
    let key;
    if (b !== 'air' && b !== '@part' && B[b]?.kind === 'wall') key = 'wall';
    else if (f === 'empty' || f === 'space') key = 'void';
    else key = FLOOR_LABEL[f] ?? (B[f]?.liquid ? 'water' : null);
    if (!key) {
      // unknown floor: closest palette colour
      const c = B[f]?.color ?? [128, 128, 128];
      let best = 'stone', bd = Infinity;
      for (const [k, bio] of Object.entries(BIOMES)) {
        const bc = B[bio.base]?.color ?? [0, 0, 0];
        const d = (c[0] - bc[0]) ** 2 + (c[1] - bc[1]) ** 2 + (c[2] - bc[2]) ** 2;
        if (d < bd) { bd = d; best = k; }
      }
      key = best;
    }
    labels[i] = LABEL[key].id;
    if (LABEL[key].kind === 'land') counts[key] = (counts[key] ?? 0) + 1;
  }

  // majority filter: generalize the layout, the generator re-adds detail
  let cur = labels;
  for (let pass = 0; pass < 2 && generalize > 0; pass++) {
    const next = new Uint8Array(N), r = generalize, hist = new Uint16Array(LABELS.length);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      hist.fill(0);
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const nx = Math.min(W - 1, Math.max(0, x + dx)), ny = Math.min(H - 1, Math.max(0, y + dy));
        hist[cur[ny * W + nx]]++;
      }
      let best = cur[y * W + x], bc = 0;
      for (let l = 0; l < hist.length; l++) if (hist[l] > bc) { bc = hist[l]; best = l; }
      next[y * W + x] = best;
    }
    cur = next;
  }

  const sk = emptySketch(W, H, base ?? Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'stone');
  sk.labels = cur;
  sk.cores = [];
  for (const [i, bld] of map.buildings ?? []) {
    const name = map.block[i];
    if (name?.startsWith('core-')) sk.cores.push({ pos: [i % W, (i / W) | 0], team: bld.team, block: name });
  }
  sk.spawns = [];
  for (let i = 0; i < N; i++) if (map.overlay[i] === 'spawn') sk.spawns.push([i % W, (i / W) | 0]);
  sk.name = map.tags?.name;
  sk.author = map.tags?.author;
  sk.description = map.tags?.description;
  return sk;
}

/** Locked tiles: keep their content across regenerations. locks = Map<index, {floor, overlay, block}> */
export function applyLocks(map, locks) {
  for (const [i, t] of locks) {
    map.floor[i] = t.floor; map.overlay[i] = t.overlay;
    if (map.block[i] === '@part' || map.buildings.has(i)) continue; // don't break cores
    map.block[i] = t.block;
  }
  return map;
}
