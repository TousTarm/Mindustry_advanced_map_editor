// Hand-drawn image -> sketch labels. Only red strokes matter (other colours are ignored). Small gaps in the strokes
// are closed, then regions are filled by nesting depth: outside of the outline = rock, inside = land, a shape drawn
// inside the land = rock, a hole in that = land... Tiny regions always become rock.
import { LABEL } from './palettes.js';

export const IMAGE_DEFAULTS = {
  closeGaps: 3, // tiles; gaps in the outline up to ~2x this get closed
  lineWidth: 3, // wall thickness of red strokes, tiles
  minArea: 0.004, // enclosed regions smaller than this fraction of the map become solid rock
};

export const isRed = (r, g, b, a = 255) => a > 100 && r > 140 && r - g > 70 && r - b > 40;

function dilate(mask, W, H, r) {
  if (r <= 0) return mask.slice();
  const out = new Uint8Array(W * H), offs = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) if (dx * dx + dy * dy <= r * r + 0.3) offs.push([dx, dy]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    for (const [dx, dy] of offs) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < W && ny < H) out[ny * W + nx] = 1;
    }
  }
  return out;
}

/** Red-stroke mask at map resolution. rgba is image pixels (top row first); map y points up. */
export function redMask(rgba, iw, ih, W, H) {
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px0 = Math.floor((x * iw) / W), px1 = Math.max(px0 + 1, Math.floor(((x + 1) * iw) / W));
    const py0 = Math.floor(((H - 1 - y) * ih) / H), py1 = Math.max(py0 + 1, Math.floor(((H - y) * ih) / H));
    let hit = false;
    for (let py = py0; py < py1 && !hit; py++) for (let px = px0; px < px1; px++) {
      const o = (py * iw + px) * 4;
      if (isRed(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3])) { hit = true; break; }
    }
    mask[y * W + x] = hit ? 1 : 0;
  }
  return mask;
}

/** Returns a Uint8Array of sketch labels (0 = base biome land, wall label for walls). */
export function imageToLabels(rgba, iw, ih, W, H, opts = {}) {
  const o = { ...IMAGE_DEFAULTS, ...opts };
  const N = W * H, red = redMask(rgba, iw, ih, W, H);
  const closed = dilate(red, W, H, o.closeGaps);

  // connected components of the open area
  const comp = new Int32Array(N).fill(-1), sizes = [], touchesBorder = [];
  const stack = [];
  for (let s = 0; s < N; s++) {
    if (closed[s] || comp[s] >= 0) continue;
    const id = sizes.length;
    let size = 0, border = false;
    stack.push(s); comp[s] = id;
    while (stack.length) {
      const i = stack.pop(), x = i % W, y = (i / W) | 0;
      size++;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) border = true;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !closed[j] && comp[j] < 0) { comp[j] = id; stack.push(j); }
      }
    }
    sizes.push(size); touchesBorder.push(border);
  }

  // Give every line-band tile to the nearest region, then find which regions touch across a line.
  const owner = comp.slice(), queue = new Int32Array(N);
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++) if (owner[i] >= 0) queue[tail++] = i;
  const R = sizes.length, adj = Array.from({ length: R }, () => new Set());
  while (head < tail) {
    const i = queue[head++], x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0) continue;
      if (owner[j] < 0) { owner[j] = owner[i]; queue[tail++] = j; }
      else if (owner[j] !== owner[i]) { adj[owner[i]].add(owner[j]); adj[owner[j]].add(owner[i]); }
    }
  }

  // Even-odd nesting: the outside (touching the map border) is depth 0 = rock, regions across one line are
  // depth 1 = land, a shape drawn inside the land is depth 2 = rock again, and so on.
  const depth = new Int32Array(R).fill(-1), rq = [];
  for (let r = 0; r < R; r++) if (touchesBorder[r]) { depth[r] = 0; rq.push(r); }
  for (let k = 0; k < rq.length; k++) for (const n of adj[rq[k]]) if (depth[n] < 0) { depth[n] = depth[rq[k]] + 1; rq.push(n); }
  const solid = new Uint8Array(R);
  for (let r = 0; r < R; r++) {
    const d = depth[r] < 0 ? 1 : depth[r];
    solid[r] = d % 2 === 0 || sizes[r] < o.minArea * N ? 1 : 0;
  }

  const lines = dilate(red, W, H, Math.max(0, (o.lineWidth - 1) / 2));
  const wall = LABEL.wall.id, labels = new Uint8Array(N);
  let land = 0;
  for (let i = 0; i < N; i++) {
    if (lines[i] || (owner[i] >= 0 && solid[owner[i]])) labels[i] = wall;
    else land++;
  }
  // if nothing is enclosed (no closed outline), fall back to just the lines
  if (land < N * 0.05) for (let i = 0; i < N; i++) labels[i] = lines[i] ? wall : 0;
  return labels;
}
