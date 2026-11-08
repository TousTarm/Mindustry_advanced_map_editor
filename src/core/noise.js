// Seeded 2D simplex noise, fBm, ridged noise, PRNG and Euclidean distance transform.

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...parts) {
  let h = 2166136261;
  for (const p of parts.join('|')) h = Math.imul(h ^ p.charCodeAt(0), 16777619);
  return h >>> 0;
}

const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const GRAD = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

/** Returns simplex(x, y) in roughly [-1, 1]. */
export function simplex(seed) {
  const r = rng(seed), perm = new Uint8Array(512), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return (x, y) => {
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s);
    const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) { const g = GRAD[perm[ii + perm[jj]] & 7]; t0 *= t0; n += t0 * t0 * (g[0] * x0 + g[1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) { const g = GRAD[perm[ii + i1 + perm[jj + j1]] & 7]; t1 *= t1; n += t1 * t1 * (g[0] * x1 + g[1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) { const g = GRAD[perm[ii + 1 + perm[jj + 1]] & 7]; t2 *= t2; n += t2 * t2 * (g[0] * x2 + g[1] * y2); }
    return 70 * n;
  };
}

/** Fractal noise. scale = feature size in tiles. Returns roughly [-1, 1]. */
export function fbm(seed, { scale = 32, octaves = 4, persistence = 0.5, lacunarity = 2 } = {}) {
  const layers = Array.from({ length: octaves }, (_, i) => simplex(seed + i * 1013));
  let norm = 0;
  for (let i = 0, a = 1; i < octaves; i++, a *= persistence) norm += a;
  return (x, y) => {
    let v = 0, a = 1, f = 1 / scale;
    for (let i = 0; i < octaves; i++) { v += a * layers[i](x * f, y * f); a *= persistence; f *= lacunarity; }
    return v / norm;
  };
}

/** Ridged noise in [0, 1]; 1 on ridges. Good for veins and cracks. */
export function ridged(seed, opts) {
  const n = fbm(seed, opts);
  return (x, y) => 1 - Math.abs(n(x, y));
}

/**
 * Exact Euclidean distance transform (Felzenszwalb). `inside(i)` marks source tiles.
 * Returns Float32Array of distance from each tile to the nearest source tile.
 */
export function edt(width, height, inside) {
  const INF = 1e20, n = Math.max(width, height);
  const g = new Float64Array(width * height);
  for (let i = 0; i < width * height; i++) g[i] = inside(i) ? 0 : INF;
  const f = new Float64Array(n), d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1);
  const pass = (len, get, set) => {
    for (let q = 0; q < len; q++) f[q] = get(q);
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s;
      do { const p = v[k]; s = (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p); } while (s <= z[k] && --k >= 0);
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
    for (let q = 0; q < len; q++) set(q, d[q]);
  };
  for (let x = 0; x < width; x++) pass(height, (q) => g[q * width + x], (q, val) => { g[q * width + x] = val; });
  for (let y = 0; y < height; y++) pass(width, (q) => g[y * width + q], (q, val) => { g[y * width + q] = val; });
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(g[i]);
  return out;
}
