// Renders a map (or a rectangular region of it) to an RGBA buffer using the sprite atlas.
// Isomorphic (Node + browser). atlas = { width, height, data: RGBA }, catalog = data/catalog.json

const TEAM_COLORS = { 0: [77, 78, 88], 1: [255, 211, 127], 2: [243, 94, 82], 3: [84, 209, 101], 4: [149, 103, 255], 5: [69, 138, 255] };

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * In-game "darkness" inside wall masses (World.addDarkness): 0 at walls touching open ground,
 * +1 per tile deeper (4-neighbour), capped at 4; the map border is darkened too.
 */
export function computeDarkness(map, catalog) {
  const { width: W, height: H } = map, N = W * H, B = catalog.blocks;
  const dark = new Float32Array(N);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  const dist = new Int16Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const b = map.block[i];
    if (!(b && b !== 'air' && B[b]?.kind === 'wall')) { dist[i] = 0; queue[tail++] = i; }
  }
  while (head < tail) {
    const i = queue[head++], x = i % W, d = dist[i];
    if (d >= 5) continue;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j >= 0 && j < N && dist[j] < 0) { dist[j] = d + 1; queue[tail++] = j; }
    }
  }
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    let d = dist[i] < 0 ? 4 : Math.max(0, Math.min(4, dist[i] - 1));
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
    if (edge <= 2) d = Math.max(d, (2 - edge) * 2);
    dark[i] = d;
  }
  return dark;
}

/**
 * @param map {width,height,floor[],overlay[],block[],buildings}
 * @param opts {scale: px per tile, mode: 'sprite'|'color', region: [x0, y0, w, h] in tiles (default whole map),
 *   darkness: Float32Array from computeDarkness (computed if omitted; pass false to disable)}
 */
export function renderMap(map, catalog, atlas, opts = {}) {
  const T = catalog.tile;
  const S = opts.scale ?? T;
  const mode = opts.mode ?? (S >= 4 ? 'sprite' : 'color');
  const { width, height } = map;
  const [rx0, ry0, rw, rh] = opts.region ?? [0, 0, width, height];
  const rx1 = Math.min(width, rx0 + rw), ry1 = Math.min(height, ry0 + rh);
  const W = rw * S, H = rh * S;
  const out = new Uint8ClampedArray(W * H * 4);
  const B = catalog.blocks;
  // pad the loop region so multiblocks, shadows and edge blending that cross the region border still draw
  const pad = 3;
  const lx0 = Math.max(0, rx0 - pad), ly0 = Math.max(0, ry0 - pad), lx1 = Math.min(width, rx1 + pad), ly1 = Math.min(height, ry1 + pad);

  // tile (tx, ty) -> pixel origin; Mindustry y points up, image y points down
  const ox = (tx) => (tx - rx0) * S;
  const oy = (ty) => (ry0 + rh - 1 - ty) * S;

  const put = (px, py, r, g, b, a = 255) => {
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const o = (py * W + px) * 4;
    if (a >= 255) { out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255; return; }
    const k = a / 255;
    out[o] = out[o] * (1 - k) + r * k; out[o + 1] = out[o + 1] * (1 - k) + g * k; out[o + 2] = out[o + 2] * (1 - k) + b * k; out[o + 3] = 255;
  };

  const sample = (spr, u, v) => {
    const ax = spr[0] + Math.min(T - 1, Math.floor(u * T)), ay = spr[1] + Math.min(T - 1, Math.floor(v * T));
    const o = (ay * atlas.width + ax) * 4;
    return [atlas.data[o], atlas.data[o + 1], atlas.data[o + 2], atlas.data[o + 3]];
  };

  const drawTile = (tx, ty, name, shade = 1) => {
    const b = B[name];
    if (!b) return;
    const py0 = oy(ty), px0 = ox(tx);
    if (mode === 'color' || !b.sprites) {
      const c = b.color ?? [255, 0, 255];
      const k = (mode === 'color' ? 0.94 + (hash(tx, ty) % 13) / 100 : 1) * shade;
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) put(px0 + x, py0 + y, c[0] * k, c[1] * k, c[2] * k);
      return;
    }
    const spr = b.sprites[hash(tx, ty) % b.sprites.length];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const [r, g, bl, a] = sample(spr, (x + 0.5) / S, (y + 0.5) / S);
      if (a) put(px0 + x, py0 + y, r * shade, g * shade, bl * shade, a);
    }
  };

  const idx = (x, y) => y * width + x;
  const isSolid = (i) => { const n = map.block[i]; return n && n !== 'air' && (n === '@part' || B[n]?.kind === 'wall' || B[n]?.kind === 'building'); };

  // 1. floors
  for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) drawTile(x, y, map.floor[idx(x, y)]);

  // 2. floor edge blending: neighbours bleed into this tile with a soft, jagged falloff (approximates the game's edge stencil)
  if (mode === 'sprite' && S >= 4) {
    const order = (n) => (B[n]?.liquid ? 0 : 1); // land draws over liquid
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
      const f = map.floor[idx(x, y)];
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nf = map.floor[idx(nx, ny)];
        if (nf === f || order(nf) < order(f) || (order(nf) === order(f) && nf < f)) continue;
        const nb = B[nf];
        if (!nb?.sprites) continue;
        const spr = nb.sprites[hash(nx, ny) % nb.sprites.length];
        const py0 = oy(y), px0 = ox(x);
        for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
          const d = dx === 1 ? 1 - (px + 0.5) / S : dx === -1 ? (px + 0.5) / S : dy === 1 ? (py + 0.5) / S : 1 - (py + 0.5) / S;
          const jag = ((hash(x * 7 + px, y * 13 + py) % 100) / 100) * 0.25;
          const a = Math.max(0, 1 - (d + jag) / 0.42);
          if (a <= 0) continue;
          const [r, g, bl, sa] = sample(spr, (px + 0.5) / S, (py + 0.5) / S);
          put(px0 + px, py0 + py, r, g, bl, sa * a);
        }
      }
    }
  }

  // 3. overlays (ores)
  for (let y = ry0; y < ry1; y++) for (let x = rx0; x < rx1; x++) {
    const o = map.overlay[idx(x, y)];
    if (o && o !== 'air' && o !== 'spawn') drawTile(x, y, o);
  }

  // 4. wall shadows (offset down-left like the game)
  const sh = Math.max(1, Math.round(S * 0.35));
  for (let y = ly0; y < ly1; y++) for (let x = lx0; x < lx1; x++) {
    if (!isSolid(idx(x, y))) continue;
    const py0 = oy(y) + sh, px0 = ox(x) - sh;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) put(px0 + px, py0 + py, 0, 0, 0, 70);
  }

  // 5. blocks: walls, props, buildings
  for (let y = ly0; y < ly1; y++) for (let x = lx0; x < lx1; x++) {
    const i = idx(x, y), n = map.block[i];
    if (!n || n === 'air' || n === '@part') continue;
    const b = B[n];
    if (b?.kind === 'building') {
      const size = b.size ?? 1, off = Math.floor((size - 1) / 2);
      const team = map.buildings?.get(i)?.team ?? 1;
      const tc = TEAM_COLORS[team] ?? [200, 200, 200];
      const spr = b.sprites?.[0];
      const bx0 = ox(x - off), by0 = oy(y - off + size - 1);
      for (let py = 0; py < size * S; py++) for (let px = 0; px < size * S; px++) {
        if (spr && mode === 'sprite') {
          const ax = spr[0] + Math.floor((px / (size * S)) * size * T), ay = spr[1] + Math.floor((py / (size * S)) * size * T);
          const o = (ay * atlas.width + ax) * 4;
          if (atlas.data[o + 3]) put(bx0 + px, by0 + py, atlas.data[o], atlas.data[o + 1], atlas.data[o + 2], atlas.data[o + 3]);
        } else put(bx0 + px, by0 + py, ...tc);
      }
      // team colour outline
      for (let k = 0; k < size * S; k++) {
        put(bx0 + k, by0, ...tc); put(bx0 + k, by0 + size * S - 1, ...tc); put(bx0, by0 + k, ...tc); put(bx0 + size * S - 1, by0 + k, ...tc);
      }
      continue;
    }
    if (x < rx0 || x >= rx1 || y < ry0 || y >= ry1) continue;
    drawTile(x, y, n);
  }

  // 6. darkness inside wall masses, bilinear like the game's blurred darkness shader
  const dark = opts.darkness === false ? null : opts.darkness ?? computeDarkness(map, catalog);
  if (dark) {
    const dAt = (x, y) => dark[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
    for (let py = 0; py < H; py++) {
      const ty = ry0 + rh - 1 - (py + 0.5) / S + 0.5; // tile-space y (centre of tile = integer)
      const fy = ty - 0.5, y0 = Math.floor(fy), wy = fy - y0;
      for (let px = 0; px < W; px++) {
        const fx = rx0 + (px + 0.5) / S - 0.5, x0 = Math.floor(fx), wx = fx - x0;
        const d = (dAt(x0, y0) * (1 - wx) + dAt(x0 + 1, y0) * wx) * (1 - wy) + (dAt(x0, y0 + 1) * (1 - wx) + dAt(x0 + 1, y0 + 1) * wx) * wy;
        if (d <= 0.02) continue;
        const k = 1 - Math.min((d + 0.5) / 4, 1), o = (py * W + px) * 4;
        out[o] *= k; out[o + 1] *= k; out[o + 2] *= k;
      }
    }
  }

  // 7. spawn markers
  for (let y = ly0; y < ly1; y++) for (let x = lx0; x < lx1; x++) {
    if (map.overlay[idx(x, y)] !== 'spawn') continue;
    const cx = ox(x) + S / 2, cy = oy(y) + S / 2, R = S * 3;
    for (let py = -R; py <= R; py++) for (let px = -R; px <= R; px++) {
      if (Math.abs(Math.hypot(px, py) - R + 1) < Math.max(1, S * 0.3)) put(Math.round(cx + px), Math.round(cy + py), 243, 94, 82, 230);
    }
  }

  return { width: W, height: H, data: out };
}
