// Sketch = coarse semantic layout: a label grid (see LABELS) plus markers (core, spawns, ore spots).
// A spec is the JSON form (shapes) that Claude / the CLI writes; rasterizeSpec turns it into a grid.
import { LABEL } from './palettes.js';
import { fbm, hashSeed } from './noise.js';
import { rleDecode } from './project.js';

export function emptySketch(width, height, base = 'stone') {
  return { width, height, base, labels: new Uint8Array(width * height), fixed: new Uint8Array(width * height), cores: [], spawns: [], ores: [] };
}

function labelId(key) {
  const l = LABEL[key];
  if (!l) throw new Error(`Unknown label "${key}". Known: ${Object.keys(LABEL).join(', ')}`);
  return l.id;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return [Math.hypot(px - ax - t * dx, py - ay - t * dy), t];
}

/** Catmull-Rom smoothing so hand-placed path points become flowing curves. */
function smoothPath(pts, steps = 8) {
  if (pts.length < 3) return pts;
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Paint a shape into a label grid. Coordinates are tiles, y up (Mindustry convention). */
export function paintShape(sk, shape, seed = 0) {
  const { width: W, height: H, labels } = sk;
  const id = shape.label == null ? 0 : labelId(shape.label);
  // fixed shapes are kept exactly as drawn; relative (default) shapes are hints for the noise
  sk.fixed ??= new Uint8Array(W * H);
  const fx = shape.fixed ? 1 : 0, fixedArr = sk.fixed;
  const paint = (test, x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1) => {
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (test(x + 0.5, y + 0.5)) { labels[y * W + x] = id; fixedArr[y * W + x] = id ? fx : 0; }
  };
  switch (shape.type) {
    case 'fill': paint(() => true); break;
    case 'rect': { const [x, y, w, h] = shape.rect; paint(() => true, x, y, x + w - 1, y + h - 1); break; }
    case 'circle':
    case 'ellipse': {
      const [cx, cy] = shape.center, rx = shape.rx ?? shape.r, ry = shape.ry ?? shape.r;
      paint((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, cx - rx, cy - ry, cx + rx, cy + ry);
      break;
    }
    case 'polygon': {
      const xs = shape.points.map((p) => p[0]), ys = shape.points.map((p) => p[1]);
      paint((x, y) => pointInPoly(x, y, shape.points), Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
      break;
    }
    case 'path': {
      // width may be a number or [startWidth, endWidth]; it also wobbles along the path for a natural river
      const pts = smoothPath(shape.points);
      const [w0, w1] = Array.isArray(shape.width) ? shape.width : [shape.width, shape.width];
      const wob = fbm(hashSeed(seed, 'pathw', JSON.stringify(shape.points[0])), { scale: 20, octaves: 2 });
      const maxW = Math.max(w0, w1) * 1.5;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      // cumulative length for interpolating width
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const total = cum[cum.length - 1] || 1;
      paint((x, y) => {
        for (let i = 0; i < pts.length - 1; i++) {
          const [d, t] = distToSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
          if (d > maxW) continue;
          const along = (cum[i] + t * (cum[i + 1] - cum[i])) / total;
          const w = (w0 + (w1 - w0) * along) * (1 + 0.35 * wob(along * total, 0));
          if (d <= w / 2) return true;
        }
        return false;
      }, Math.min(...xs) - maxW, Math.min(...ys) - maxW, Math.max(...xs) + maxW, Math.max(...ys) + maxW);
      break;
    }
    default: throw new Error(`Unknown shape type "${shape.type}"`);
  }
}

/**
 * spec: { width, height, base, seed, labelsRLE?, shapes: [{..., fixed?: true}], fixedRLE?, core: [x,y] | cores: [{pos, team, block}], spawns: [[x,y]], ores: [{ore, center, r}] }
 */
export function rasterizeSpec(spec) {
  const sk = emptySketch(spec.width, spec.height, spec.base ?? 'stone');
  if (spec.labelsRLE) sk.labels = rleDecode(spec.labelsRLE, spec.width * spec.height);
  if (spec.fixedRLE) sk.fixed = rleDecode(spec.fixedRLE, spec.width * spec.height);
  for (const s of spec.shapes ?? []) paintShape(sk, s, spec.seed ?? 0);
  sk.cores = spec.cores ?? (spec.core ? [{ pos: spec.core, team: 1, block: spec.coreBlock ?? 'core-shard' }] : []);
  for (const k of ['name', 'author', 'description', 'rules']) if (spec[k]) sk[k] = spec[k];
  sk.spawns = spec.spawns ?? [];
  sk.ores = spec.ores ?? [];
  return sk;
}
