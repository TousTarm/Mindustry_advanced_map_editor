import catalog from '../data/catalog.json';
import templates from '../data/templates.json';
import { renderMap } from '../src/core/render.js';
import { readMsav, writeMsav } from '../src/core/msav.js';
import { emptySketch, paintShape, rasterizeSpec } from '../src/core/sketch.js';
import { DEFAULT_PARAMS } from '../src/core/generate.js';
import { LABELS, LABEL, BIOMES, LIQUIDS, ORES } from '../src/core/palettes.js';
import { deriveSketch, sketchToSpec, applyLocks } from '../src/core/project.js';
import { imageToLabels } from '../src/core/imagesketch.js';

const $ = (s) => document.querySelector(s);
const B = catalog.blocks;

const LABEL_NAMES = {
  wall: 'Skála', void: 'Prázdno', sand: 'Písek', darksand: 'Tmavý písek', stone: 'Kámen', grass: 'Tráva', snow: 'Sníh',
  ice: 'Led', moss: 'Mech', spore: 'Spóry', shale: 'Břidlice', basalt: 'Čedič', salt: 'Sůl', dirt: 'Hlína',
  water: 'Voda', tainted: 'Kontam. voda', slag: 'Struska', tar: 'Dehet', cryo: 'Kryo',
};

const PARAMS = [
  ['warp', 'Zvlnění tvarů', 0, 30, 0.5, 'Jak moc se velké tvary ze skici kroutí'],
  ['rough', 'Roztřepení okrajů', 0, 10, 0.25, 'Drobná nepravidelnost hran'],
  ['liquidWarp', 'Zvlnění vody', 0, 1, 0.05, 'Řeky drží skicu víc než pevnina (0 = přesně podle skici)'],
  ['dither', 'Prolínání biomů', 0, 5, 0.1, 'Tečkovaný přechod mezi biomy'],
  ['detail', 'Detail podlah', 0, 2, 0.05, 'Množství skvrn sekundárních podlah'],
  ['shore', 'Šířka pláží', 0, 3, 0.05, 'Pásy písku a mělčin u vody'],
  ['rocks', 'Skály', 0, 1, 0.01, 'Hustota skalních útvarů uvnitř pevniny'],
  ['rockScale', 'Velikost skal', 6, 60, 1, 'Velikost skalních útvarů'],
  ['smooth', 'Vyhlazení skal', 0, 5, 1, 'Průchody cellular automata'],
  ['border', 'Okraj mapy', 0, 12, 1, 'Tloušťka skály na okraji mapy'],
  ['boulders', 'Balvany', 0, 0.1, 0.002, 'Hustota balvanů (víc u skal)'],
  ['trees', 'Stromy', 0, 1, 0.05, 'Stromy v trávě a sněhu'],
  ['ores', 'Rudy', 0, 3, 0.05, 'Množství rud (vzácnější dál od core)'],
  ['coreClear', 'Volno u core', 3, 20, 1, 'Poloměr volného místa kolem core'],
  ['deep', 'Hloubka vody', 0, 2, 0.05, '0 = jen mělká voda, víc = hluboká voda dřív od břehu'],
];
const PARAM_CHECKS = [['oresOn', 'Rudy'], ['startOres', 'Měď a olovo u core'], ['ensurePath', 'Zaručit cestu spawn → core']];
const SHORE_NAMES = { water: 'voda', tainted: 'kontam. voda', slag: 'struska', tar: 'dehet', cryo: 'kryo' };

const SKETCH_TOOLS = [
  ['brush', '🖌', 'Štětec', 'B'], ['erase', '⌫', 'Guma', 'E'], ['fill', '🪣', 'Výplň', 'F'], ['path', '〰', 'Řeka', 'L'],
  ['line', '╱', 'Čára', 'N'], ['rect', '▭', 'Obdélník', 'R'], ['ellipse', '◯', 'Elipsa', 'O'], ['core', '▣', 'Core', 'C'],
  ['spawn', '◎', 'Spawn', 'S'], ['ore', '◆', 'Ruda', 'U'], ['pan', '✋', 'Posun', 'Space'],
];
const EDIT_TOOLS = [
  ['brush', '🖌', 'Štětec', 'B'], ['erase', '⌫', 'Guma', 'E'], ['line', '╱', 'Čára', 'L'], ['spray', '💨', 'Sprej', 'P'],
  ['fill', '🪣', 'Výplň', 'F'], ['picker', '💧', 'Kapátko', 'I'], ['lock', '🔒', 'Zamknout', 'K'], ['unlock', '🔓', 'Odemknout', 'J'], ['pan', '✋', 'Posun', 'Space'],
];

// ---------------------------------------------------------------- state
const S = {
  sketch: null, params: structuredClone(DEFAULT_PARAMS), map: null, locks: new Map(),
  mode: 'sketch', tool: 'brush', label: 'water', block: 'stone-wall', ore: 'ore-titanium', brush: 6, symmetry: 'none',
  view: { ox: 0, oy: 0, zoom: 4 }, sketchOpacity: 0, showLocks: true, showGrid: false, autoGen: true,
  undo: [], redo: [], blockTab: 'floor', blockQuery: '', brushShape: 'circle', fixedMode: false,
  bg: null, bgOpacity: 0.4, // background image: {url, img, rect: [x0, y0, w, h] in tiles, flipX, flipY}
};
const inBrush = (dx, dy, r) => (S.brushShape === 'square' ? Math.max(Math.abs(dx), Math.abs(dy)) <= r + 0.01 : dx * dx + dy * dy <= r * r + 0.25);
let atlas, atlasUrl;
const canvas = $('#canvas'), ctx = canvas.getContext('2d');

// ---------------------------------------------------------------- helpers
const W = () => S.sketch.width, H = () => S.sketch.height;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const status = (t) => ($('#status').textContent = t);
const randSeed = () => Math.floor(Math.random() * 1e9);
const cloneMap = (m) => m && { ...m, floor: m.floor.slice(), overlay: m.overlay.slice(), block: m.block.slice(), buildings: new Map(m.buildings), tags: { ...m.tags } };
const markersOf = (sk) => JSON.stringify({ cores: sk.cores, spawns: sk.spawns, ores: sk.ores });
const toB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const hexToRgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));

function toast(html, actions = []) {
  const t = $('#toast');
  t.innerHTML = `<span>${html}</span>`;
  for (const [label, fn, cls] of actions) {
    const b = document.createElement('button');
    b.textContent = label; if (cls) b.className = cls;
    b.onclick = () => { t.hidden = true; fn?.(); };
    t.appendChild(b);
  }
  t.hidden = false;
  if (!actions.length) setTimeout(() => (t.hidden = true), 2500);
}

// ---------------------------------------------------------------- chunked map rendering
const CHUNK = 32;
let chunkScale = 16;
let chunks = new Map(); // key -> canvas | null (dirty)
function resetChunks() {
  chunks = new Map();
  chunkScale = W() * H() > 300 * 300 ? 8 : 16;
}
function invalidate(x0, y0, x1, y1) {
  const p = 4; // shadows / edge blending reach into neighbours
  for (let cy = Math.floor((y0 - p) / CHUNK); cy <= Math.floor((y1 + p) / CHUNK); cy++)
    for (let cx = Math.floor((x0 - p) / CHUNK); cx <= Math.floor((x1 + p) / CHUNK); cx++) chunks.delete(cx + ',' + cy);
  requestDraw();
}
function renderChunk(cx, cy) {
  const x0 = cx * CHUNK, y0 = cy * CHUNK, w = Math.min(CHUNK, W() - x0), h = Math.min(CHUNK, H() - y0);
  const img = renderMap(S.map, catalog, atlas, { scale: chunkScale, region: [x0, y0, w, h] });
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  return c;
}

// sketch / lock layers at 1px per tile
const sketchLayer = document.createElement('canvas'), lockLayer = document.createElement('canvas');
function updateSketchLayer() {
  const sk = S.sketch;
  sketchLayer.width = sk.width; sketchLayer.height = sk.height;
  const g = sketchLayer.getContext('2d'), img = g.createImageData(sk.width, sk.height);
  const colors = LABELS.map((l) => hexToRgb(l.color));
  const base = colors[LABEL[sk.base].id];
  for (let y = 0; y < sk.height; y++) for (let x = 0; x < sk.width; x++) {
    const i = y * sk.width + x, l = sk.labels[i], c = l ? colors[l] : base, o = ((sk.height - 1 - y) * sk.width + x) * 4;
    let k = 1;
    if (sk.fixed?.[i]) {
      const edge = x === 0 || y === 0 || x === sk.width - 1 || y === sk.height - 1 || !sk.fixed[i - 1] || !sk.fixed[i + 1] || !sk.fixed[i - sk.width] || !sk.fixed[i + sk.width];
      k = edge ? 0 : 1.25;
    }
    img.data[o] = k ? c[0] * k : 255; img.data[o + 1] = k ? c[1] * k : 255; img.data[o + 2] = k ? c[2] * k : 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  requestDraw();
}
function updateLockLayer() {
  lockLayer.width = W(); lockLayer.height = H();
  const g = lockLayer.getContext('2d'), img = g.createImageData(W(), H());
  for (const i of S.locks.keys()) {
    const x = i % W(), y = (i / W()) | 0, o = ((H() - 1 - y) * W() + x) * 4;
    img.data[o] = 90; img.data[o + 1] = 170; img.data[o + 2] = 255; img.data[o + 3] = 45;
  }
  g.putImageData(img, 0, 0);
  requestDraw();
}

let drawQueued = false;
function requestDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(draw); } }

function draw() {
  drawQueued = false;
  const dpr = devicePixelRatio || 1, cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) { canvas.width = cw * dpr; canvas.height = ch * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0d0d10'; ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;
  const { ox, oy, zoom } = S.view, w = W(), h = H();

  ctx.fillStyle = '#000'; ctx.fillRect(ox, oy, w * zoom, h * zoom);
  if (S.map) {
    let budget = 8, pending = false;
    for (let cy = 0; cy * CHUNK < h; cy++) for (let cx = 0; cx * CHUNK < w; cx++) {
      const x0 = cx * CHUNK, y0 = cy * CHUNK, cw2 = Math.min(CHUNK, w - x0), ch2 = Math.min(CHUNK, h - y0);
      const sx = ox + x0 * zoom, sy = oy + (h - y0 - ch2) * zoom;
      if (sx > cw || sy > ch || sx + cw2 * zoom < 0 || sy + ch2 * zoom < 0) continue;
      const key = cx + ',' + cy;
      let c = chunks.get(key);
      if (!c) {
        if (budget-- <= 0) { pending = true; continue; }
        c = renderChunk(cx, cy); chunks.set(key, c);
      }
      ctx.drawImage(c, sx, sy, cw2 * zoom, ch2 * zoom);
    }
    if (pending) requestDraw();
  }
  const sketchAlpha = S.map ? (S.mode === 'sketch' ? S.sketchOpacity : 0) : 1;
  if (sketchAlpha > 0) { ctx.globalAlpha = sketchAlpha; ctx.drawImage(sketchLayer, ox, oy, w * zoom, h * zoom); ctx.globalAlpha = 1; }
  if (S.bg?.img && S.bgOpacity > 0) {
    const [bx, by, bw, bh] = S.bg.rect;
    ctx.save();
    ctx.globalAlpha = S.bgOpacity;
    ctx.imageSmoothingEnabled = true;
    ctx.translate(ox + (bx + (S.bg.flipX ? bw : 0)) * zoom, oy + (h - by - bh + (S.bg.flipY ? bh : 0)) * zoom);
    ctx.scale(S.bg.flipX ? -1 : 1, S.bg.flipY ? -1 : 1);
    ctx.drawImage(S.bg.img, 0, 0, bw * zoom, bh * zoom);
    ctx.restore();
    ctx.imageSmoothingEnabled = false;
  }
  if (S.showLocks && S.mode === 'edit' && S.locks.size && S.map) ctx.drawImage(lockLayer, ox, oy, w * zoom, h * zoom);

  if (S.showGrid && zoom >= 6) {
    ctx.strokeStyle = '#ffffff18'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x <= w; x++) { ctx.moveTo(ox + x * zoom + 0.5, oy); ctx.lineTo(ox + x * zoom + 0.5, oy + h * zoom); }
    for (let y = 0; y <= h; y++) { ctx.moveTo(ox, oy + y * zoom + 0.5); ctx.lineTo(ox + w * zoom, oy + y * zoom + 0.5); }
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffffff30'; ctx.strokeRect(ox - 0.5, oy - 0.5, w * zoom + 1, h * zoom + 1);

  if (S.mode === 'sketch') drawMarkers();
  drawToolPreview();
}

const tileToScreen = (x, y) => [S.view.ox + (x + 0.5) * S.view.zoom, S.view.oy + (H() - 1 - y + 0.5) * S.view.zoom];
function drawMarkers() {
  const z = S.view.zoom, sk = S.sketch;
  for (const c of sk.cores) {
    const [sx, sy] = tileToScreen(...c.pos), size = (B[c.block]?.size ?? 3) * z;
    ctx.fillStyle = c.team === 1 ? '#ffd37fcc' : '#f35e52cc';
    ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
    ctx.strokeStyle = '#000'; ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);
  }
  for (const s of sk.spawns) {
    const [sx, sy] = tileToScreen(...s);
    ctx.strokeStyle = '#f35e52'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, Math.max(6, 3 * z), 0, 7); ctx.stroke(); ctx.lineWidth = 1;
  }
  for (const o of sk.ores) {
    const [sx, sy] = tileToScreen(...o.center), c = B[o.ore]?.color ?? [255, 255, 255];
    ctx.strokeStyle = `rgb(${c})`; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(sx, sy, o.r * z, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------- input
let pointer = null; // current gesture
let hover = null; // [x, y] float tile coords
let pathPoints = [];

function screenToTile(e) {
  const r = canvas.getBoundingClientRect();
  const fx = (e.clientX - r.left - S.view.ox) / S.view.zoom, fr = (e.clientY - r.top - S.view.oy) / S.view.zoom;
  return [fx - 0.5, H() - fr - 0.5]; // float tile coords (centre of tile = integer)
}
const tileOf = (p) => [Math.round(p[0]), Math.round(p[1])];
const inMap = (x, y) => x >= 0 && y >= 0 && x < W() && y < H();

function symmetric(p) {
  const [x, y] = p, mx = W() - 1 - x, my = H() - 1 - y;
  switch (S.symmetry) {
    case 'x': return [[x, y], [mx, y]];
    case 'y': return [[x, y], [x, my]];
    case 'xy': return [[x, y], [mx, y], [x, my], [mx, my]];
    case 'rot2': return [[x, y], [mx, my]];
    default: return [[x, y]];
  }
}

let spaceDown = false;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = screenToTile(e);
  if (e.button === 1 || e.button === 2 || S.tool === 'pan' || spaceDown) {
    pointer = { kind: 'pan', sx: e.clientX, sy: e.clientY, ox: S.view.ox, oy: S.view.oy };
    return;
  }
  if (e.button !== 0) return;
  pointer = { kind: 'tool', start: p, last: p, shift: e.shiftKey, alt: e.altKey };
  toolDown(p, e);
});
canvas.addEventListener('pointermove', (e) => {
  const p = screenToTile(e);
  hover = p;
  const [tx, ty] = tileOf(p);
  if (inMap(tx, ty)) {
    const i = ty * W() + tx;
    const info = S.map ? `${S.map.floor[i]}${S.map.overlay[i] !== 'air' ? ' + ' + S.map.overlay[i] : ''}${S.map.block[i] !== 'air' ? ' · ' + S.map.block[i] : ''}${S.locks.has(i) ? ' 🔒' : ''}` : LABELS[S.sketch.labels[i]]?.key ?? '';
    $('#cursor-info').textContent = `${tx}, ${ty}  ${info}`;
  }
  if (pointer?.kind === 'pan') {
    S.view.ox = pointer.ox + e.clientX - pointer.sx; S.view.oy = pointer.oy + e.clientY - pointer.sy;
  } else if (pointer?.kind === 'tool') {
    toolMove(p, e);
    pointer.last = p;
  }
  requestDraw();
});
canvas.addEventListener('pointerup', (e) => {
  if (pointer?.kind === 'tool') toolUp(screenToTile(e), e);
  pointer = null;
  requestDraw();
});
canvas.addEventListener('dblclick', () => { if (S.tool === 'path') finishPath(); });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  const z0 = S.view.zoom, z1 = clamp(z0 * Math.pow(1.0015, -e.deltaY), 0.5, 48);
  S.view.ox = mx - ((mx - S.view.ox) * z1) / z0; S.view.oy = my - ((my - S.view.oy) * z1) / z0; S.view.zoom = z1;
  requestDraw();
}, { passive: false });
canvas.addEventListener('pointerleave', () => { hover = null; requestDraw(); });
window.addEventListener('resize', requestDraw);

function fitView() {
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  const z = Math.min(cw / W(), ch / H()) * 0.94;
  S.view = { zoom: z, ox: (cw - W() * z) / 2, oy: (ch - H() * z) / 2 };
  requestDraw();
}

// ---------------------------------------------------------------- tools
function toolDown(p, e) {
  const t = S.tool;
  if (S.mode === 'sketch') {
    if (t === 'brush' || t === 'erase') { pushUndo(['sketch']); paintSketchStroke(p, p); }
    else if (t === 'fill') { pushUndo(['sketch']); for (const q of symmetric(tileOf(p))) floodSketch(...q); updateSketchLayer(); afterSketchChange(); }
    else if (t === 'path') { pathPoints.push(p); }
    else if (t === 'line') { pushUndo(['sketch']); }
    else if (t === 'core' || t === 'spawn' || t === 'ore') { pushUndo(['markers']); placeMarker(t, tileOf(p), e); afterSketchChange(); }
  } else {
    if (t === 'brush' || t === 'erase' || t === 'lock' || t === 'unlock' || t === 'spray') { pushUndo(['tiles', 'locks']); paintTiles(p, p); }
    else if (t === 'line') { pushUndo(['tiles', 'locks']); }
    else if (t === 'fill') { pushUndo(['tiles', 'locks']); fillTiles(tileOf(p), e.shiftKey); }
    else if (t === 'picker') pickBlock(tileOf(p));
  }
}
function toolMove(p) {
  if (S.mode === 'sketch' && (S.tool === 'brush' || S.tool === 'erase')) paintSketchStroke(pointer.last, p);
  if (S.mode === 'edit' && ['brush', 'erase', 'lock', 'unlock', 'spray'].includes(S.tool)) paintTiles(pointer.last, p);
}
function toolUp(p) {
  const t = S.tool;
  if (S.mode === 'sketch') {
    if (t === 'brush' || t === 'erase') afterSketchChange();
    if (t === 'line') { paintSketchStroke(pointer.start, p); afterSketchChange(); }
    if (t === 'rect' || t === 'ellipse') {
      const a = pointer.start, b = p;
      if (Math.abs(a[0] - b[0]) < 1 && Math.abs(a[1] - b[1]) < 1) return;
      pushUndo(['sketch']);
      const pairs = symmetric(a).map((q, k) => [q, symmetric(b)[k]]);
      for (const [q, r] of pairs) {
        const x0 = Math.min(q[0], r[0]), y0 = Math.min(q[1], r[1]), x1 = Math.max(q[0], r[0]), y1 = Math.max(q[1], r[1]);
        const shape = t === 'rect'
          ? { type: 'rect', rect: [Math.round(x0), Math.round(y0), Math.round(x1 - x0) + 1, Math.round(y1 - y0) + 1] }
          : { type: 'ellipse', center: [(x0 + x1) / 2 + 0.5, (y0 + y1) / 2 + 0.5], rx: (x1 - x0) / 2 + 0.5, ry: (y1 - y0) / 2 + 0.5 };
        paintShape(S.sketch, { ...shape, label: currentLabelKey(), fixed: S.fixedMode }, S.params.seed);
      }
      updateSketchLayer(); afterSketchChange();
    }
  }
  if (S.mode === 'edit' && t === 'line') paintTiles(pointer.start, p);
  if (S.mode === 'edit' && ['brush', 'erase', 'fill', 'line', 'spray'].includes(t)) scheduleAutosave();
}

const currentLabelKey = () => (S.tool === 'erase' ? null : S.label);
function paintSketchStroke(a, b) {
  const sk = S.sketch, r = S.brush / 2, id = S.tool === 'erase' ? 0 : LABEL[S.label].id;
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(0.5, r / 2)));
  for (let s = 0; s <= steps; s++) {
    const c = [a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps];
    for (const [cx, cy] of symmetric(c)) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (inMap(x, y) && inBrush(x - cx, y - cy, r)) { sk.labels[y * sk.width + x] = id; sk.fixed[y * sk.width + x] = id && S.fixedMode ? 1 : 0; }
      }
    }
  }
  updateSketchLayer();
}
function floodSketch(x, y) {
  if (!inMap(x, y)) return;
  const sk = S.sketch, w = sk.width, target = sk.labels[y * w + x], id = LABEL[S.label].id;
  if (target === id) return;
  const stack = [y * w + x];
  while (stack.length) {
    const i = stack.pop();
    if (sk.labels[i] !== target) continue;
    sk.labels[i] = id; sk.fixed[i] = S.fixedMode ? 1 : 0;
    const xx = i % w;
    if (xx > 0) stack.push(i - 1); if (xx < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w); if (i < w * (sk.height - 1)) stack.push(i + w);
  }
}
function finishPath() {
  if (pathPoints.length >= 2) {
    pushUndo(['sketch']);
    const sets = pathPoints.map(symmetric);
    for (let k = 0; k < sets[0].length; k++) {
      paintShape(S.sketch, { type: 'path', label: S.label, points: sets.map((s) => s[k]), width: S.brush, fixed: S.fixedMode }, S.params.seed);
    }
    updateSketchLayer(); afterSketchChange();
  }
  pathPoints = [];
  requestDraw();
}
function placeMarker(t, pos, e) {
  const sk = S.sketch;
  const near = (list, get) => list.findIndex((m) => Math.hypot(get(m)[0] - pos[0], get(m)[1] - pos[1]) < Math.max(4, 12 / S.view.zoom));
  if (e.altKey) {
    for (const [list, get] of [[sk.cores, (m) => m.pos], [sk.spawns, (m) => m], [sk.ores, (m) => m.center]]) {
      const i = near(list, get); if (i >= 0) { list.splice(i, 1); return; }
    }
    return;
  }
  const pts = symmetric(pos).map((q) => q.map(Math.round));
  if (t === 'core') {
    if (!e.shiftKey) sk.cores = sk.cores.filter((c) => c.team !== 1 && pts.length === 1);
    pts.forEach((q, k) => sk.cores.push({ pos: q, team: e.shiftKey || k > 0 ? 2 : 1, block: 'core-shard' }));
  } else if (t === 'spawn') pts.forEach((q) => sk.spawns.push(q));
  else pts.forEach((q) => sk.ores.push({ ore: S.ore, center: q, r: Math.max(2, Math.round(S.brush / 2)) }));
}

function setTile(i, layer, name, changes) {
  const m = S.map;
  if (m[layer][i] === name) return;
  if (!changes.has(i)) changes.set(i, true);
  m[layer][i] = name;
}
function lockTile(i) { const m = S.map; S.locks.set(i, { floor: m.floor[i], overlay: m.overlay[i], block: m.block[i] }); }
function paintTiles(a, b) {
  if (!S.map) return;
  const m = S.map, r = S.brush / 2, t = S.tool, changes = new Map();
  const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / Math.max(0.5, r / 2)));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let s = 0; s <= steps; s++) {
    const c = [a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps];
    for (const [cx, cy] of symmetric(c)) {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (!inMap(x, y) || !inBrush(x - cx, y - cy, r)) continue;
        if (t === 'spray' && Math.random() > 0.12) continue;
        const i = y * W() + x;
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        if (t === 'lock') { lockTile(i); continue; }
        if (t === 'unlock') { S.locks.delete(i); continue; }
        if (m.block[i] === '@part' || m.buildings.has(i)) continue;
        if (t === 'erase') { setTile(i, 'block', 'air', changes); setTile(i, 'overlay', 'air', changes); }
        else {
          const kind = B[S.block]?.kind;
          if (kind === 'floor') setTile(i, 'floor', S.block, changes);
          else if (kind === 'overlay') setTile(i, 'overlay', S.block, changes);
          else setTile(i, 'block', S.block, changes);
        }
        lockTile(i);
      }
    }
  }
  if (x0 <= x1) { invalidate(x0, y0, x1, y1); updateLockLayer(); }
}
function fillTiles([x, y], replaceAll = false) {
  if (!S.map || !inMap(x, y)) return;
  const m = S.map, w = W(), kind = B[S.block]?.kind, layer = kind === 'floor' ? 'floor' : kind === 'overlay' ? 'overlay' : 'block';
  const start = y * w + x, target = m[layer][start];
  if (target === S.block) return;
  if (replaceAll) {
    for (let i = 0; i < w * H(); i++) if (m[layer][i] === target && m.block[i] !== '@part') { m[layer][i] = S.block; lockTile(i); }
    resetChunks(); updateLockLayer(); requestDraw();
    return;
  }
  const stack = [start], seen = new Uint8Array(w * H());
  let n = 0;
  while (stack.length && n < 200000) {
    const i = stack.pop();
    if (seen[i] || m[layer][i] !== target) continue;
    seen[i] = 1; n++;
    m[layer][i] = S.block; lockTile(i);
    const xx = i % w;
    if (xx > 0) stack.push(i - 1); if (xx < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w); if (i < w * (H() - 1)) stack.push(i + w);
  }
  resetChunks(); updateLockLayer(); requestDraw();
}
function pickBlock([x, y]) {
  if (!S.map || !inMap(x, y)) return;
  const i = y * W() + x, m = S.map;
  S.block = m.block[i] !== 'air' && m.block[i] !== '@part' ? m.block[i] : m.overlay[i] !== 'air' ? m.overlay[i] : m.floor[i];
  S.blockTab = B[S.block]?.kind ?? 'floor';
  setTool('brush');
}

function drawToolPreview() {
  if (!hover) return;
  const z = S.view.zoom;
  const brushTools = S.mode === 'sketch' ? ['brush', 'erase', 'path', 'ore', 'line'] : ['brush', 'erase', 'lock', 'unlock', 'spray', 'line'];
  if (brushTools.includes(S.tool)) {
    for (const q of symmetric(hover)) {
      const [sx, sy] = tileToScreen(...q), r = Math.max(2, (S.brush / 2) * z);
      ctx.strokeStyle = '#ffffffaa'; ctx.beginPath();
      if (S.brushShape === 'square' && S.tool !== 'ore' && S.tool !== 'path') ctx.rect(sx - r - z / 2, sy - r - z / 2, 2 * r + z, 2 * r + z); else ctx.arc(sx, sy, r, 0, 7);
      ctx.stroke();
    }
  }
  if (pointer?.kind === 'tool' && S.tool === 'line') {
    const [ax, ay] = tileToScreen(...pointer.start), [bx, by] = tileToScreen(...hover);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, S.brush * z); ctx.globalAlpha = 0.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  if (S.tool === 'path' && pathPoints.length) {
    ctx.strokeStyle = LABEL[S.label]?.color ?? '#fff'; ctx.lineWidth = Math.max(2, S.brush * z); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.6; ctx.beginPath();
    [...pathPoints, hover].forEach((p, k) => { const [sx, sy] = tileToScreen(...p); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
    ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  if (pointer?.kind === 'tool' && (S.tool === 'rect' || S.tool === 'ellipse')) {
    const [ax, ay] = tileToScreen(...pointer.start), [bx, by] = tileToScreen(...hover);
    ctx.strokeStyle = '#fff'; ctx.setLineDash([5, 4]); ctx.beginPath();
    if (S.tool === 'rect') ctx.rect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    else ctx.ellipse((ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2, Math.abs(by - ay) / 2, 0, 0, 7);
    ctx.stroke(); ctx.setLineDash([]);
  }
}

// ---------------------------------------------------------------- undo / redo (whole-state snapshots of the touched parts)
const cloneSketch = (sk) => ({ ...sk, labels: sk.labels.slice(), fixed: sk.fixed.slice(), cores: structuredClone(sk.cores), spawns: structuredClone(sk.spawns), ores: structuredClone(sk.ores) });
function snapshot(fields) {
  const s = { fields, time: Date.now() };
  if (fields.includes('all')) { s.all = { sketch: cloneSketch(S.sketch), map: cloneMap(S.map), locks: new Map(S.locks), bg: S.bg && { ...S.bg } }; return s; }
  if (fields.includes('sketch')) { s.labels = S.sketch.labels.slice(); s.fixed = S.sketch.fixed.slice(); s.markers = markersOf(S.sketch); }
  if (fields.includes('markers')) s.markers = markersOf(S.sketch);
  if (fields.includes('tiles') || fields.includes('map')) s.map = cloneMap(S.map);
  if (fields.includes('locks')) s.locks = new Map(S.locks);
  if (fields.includes('map')) s.params = structuredClone(S.params);
  return s;
}
function restore(s) {
  if (s.all) {
    S.sketch = s.all.sketch; S.map = s.all.map; S.locks = s.all.locks; S.bg = s.all.bg;
    resetChunks(); updateSketchLayer(); updateLockLayer(); syncMapUI(); requestDraw();
    return;
  }
  if (s.labels) { S.sketch.labels = s.labels; if (s.fixed) S.sketch.fixed = s.fixed; updateSketchLayer(); }
  if (s.markers) { Object.assign(S.sketch, JSON.parse(s.markers)); }
  if ('map' in s) { S.map = s.map; resetChunks(); }
  if (s.locks) { S.locks = s.locks; updateLockLayer(); }
  if (s.params) { S.params = s.params; syncParamsUI(); }
  requestDraw();
}
function pushUndo(fields) {
  // generation that follows a sketch edit belongs to the same undo step
  S.undo.push(snapshot(S.autoGen && S.mode === 'sketch' && (fields.includes('sketch') || fields.includes('markers')) ? [...fields, 'map'] : fields));
  if (S.undo.length > 60) S.undo.shift();
  S.redo = [];
}
function undo() { const s = S.undo.pop(); if (!s) return; S.redo.push(snapshot(s.fields)); restore(s); scheduleAutosave(); }
function redo() { const s = S.redo.pop(); if (!s) return; S.undo.push(snapshot(s.fields)); restore(s); scheduleAutosave(); }

// ---------------------------------------------------------------- generation (web worker)
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let genId = 0, genTimer = null;
function afterSketchChange() {
  scheduleAutosave();
  if (S.autoGen) { clearTimeout(genTimer); genTimer = setTimeout(() => generateNow(false), 60); }
  requestDraw();
}
function generateNow(recordUndo = true) {
  if (recordUndo) pushUndo(['map']);
  const id = ++genId;
  $('#busy').hidden = false;
  status('Generuji…');
  worker.postMessage({ id, sketch: { ...S.sketch, labels: S.sketch.labels.slice() }, params: S.params });
}
worker.onmessage = (e) => {
  const r = e.data;
  if (r.id !== genId) return;
  $('#busy').hidden = true;
  if (r.error) { status('Chyba generování'); console.error(r.error); toast('Generování selhalo: ' + r.error.split('\n')[0]); return; }
  const N = r.width * r.height, map = { width: r.width, height: r.height, floor: new Array(N), overlay: new Array(N), block: new Array(N), buildings: new Map(), tags: r.tags };
  for (let i = 0; i < N; i++) { map.floor[i] = r.names[r.floor[i]]; map.overlay[i] = r.names[r.overlay[i]]; map.block[i] = r.names[r.block[i]]; }
  for (const [i, team] of r.buildings) map.buildings.set(i, { team });
  applyLocks(map, S.locks);
  S.map = map;
  resetChunks();
  status(`Vygenerováno za ${Math.round(r.ms)} ms · seed ${S.params.seed}`);
  requestDraw();
};
function reroll(stage) {
  pushUndo(['map']);
  if (stage === 'all') { S.params.seed = randSeed(); S.params.seeds = {}; }
  else S.params.seeds = { ...S.params.seeds, [stage]: randSeed() };
  syncParamsUI();
  generateNow(false);
  scheduleAutosave();
}

// ---------------------------------------------------------------- project IO
function newProject(w, h, base, island) {
  S.sketch = emptySketch(w, h, base);
  if (island) {
    paintShape(S.sketch, { type: 'fill', label: 'wall' });
    paintShape(S.sketch, { type: 'ellipse', label: base, center: [w / 2, h / 2], rx: w * 0.44, ry: h * 0.44 });
  }
  S.sketch.cores = [{ pos: [Math.round(w * 0.3), Math.round(h * 0.3)], team: 1, block: 'core-shard' }];
  S.sketch.spawns = [[Math.round(w * 0.72), Math.round(h * 0.72)]];
  S.sketch.name = 'Nová mapa';
  S.bg = null;
  S.map = null; S.locks = new Map(); S.undo = []; S.redo = [];
  afterLoad();
  generateNow(false);
}
function afterLoad() {
  resetChunks(); updateSketchLayer(); updateLockLayer(); syncMapUI(); syncParamsUI(); fitView();
}
function projectJSON(includeMap = true) {
  const sk = S.sketch;
  const out = {
    format: 'mindscape-project', version: 1,
    spec: sketchToSpec(sk, { name: sk.name, author: sk.author, description: sk.description }),
    bg: S.bg && { url: S.bg.url, rect: S.bg.rect, flipX: !!S.bg.flipX, flipY: !!S.bg.flipY },
    params: S.params,
    locks: [...S.locks].map(([i, t]) => [i, t.floor, t.overlay, t.block]),
  };
  if (includeMap && S.map) out.msavBase64 = toB64(exportMsav());
  return out;
}
function loadProject(p) {
  S.sketch = rasterizeSpec(p.spec);
  if (p.params && !('deep' in p.params)) p.params.border = 0; // projects from before the border default changed
  setBackground(p.bg ?? null);
  S.params = { ...structuredClone(DEFAULT_PARAMS), ...p.params };
  S.locks = new Map((p.locks ?? []).map(([i, floor, overlay, block]) => [i, { floor, overlay, block }]));
  S.map = p.msavBase64 ? readMsav(fromB64(p.msavBase64)) : null;
  S.undo = []; S.redo = [];
  afterLoad();
  if (!S.map) generateNow(false);
}
function loadMsavBytes(bytes, name) {
  const map = readMsav(bytes);
  S.map = map;
  S.sketch = deriveSketch(map, catalog);
  S.sketch.name ||= name;
  S.bg = null;
  S.locks = new Map(); S.undo = []; S.redo = [];
  S.autoGen = false; $('#auto-gen').checked = false;
  afterLoad();
  toast(`Načteno: ${map.width}×${map.height}. Skica byla odvozena z mapy – <b>✨ Zkrášlit</b> ji přegeneruje s detaily.`, [['OK']]);
}
const BUILDING_SIZES = Object.fromEntries(Object.entries(B).filter(([, b]) => b.kind === 'building').map(([k, b]) => [k, { size: b.size ?? 1 }]));
function exportMsav() {
  const m = S.map;
  m.tags = { ...m.tags, name: S.sketch.name || 'Mindscape map', author: S.sketch.author || '', description: S.sketch.description || '' };
  m.tags.genfilters ??= '[]';
  m.tags.rules ??= '{}'; // loaded maps keep their original rules and waves
  for (const [i, b] of m.buildings) if (!b.raw) b.raw = new Uint8Array(templates.buildings[m.block[i]]?.raw ?? templates.buildings['core-shard'].raw);
  return writeMsav(m, templates.blocks, { ...BUILDING_SIZES, emptyMarkers: new Uint8Array(templates.emptyMarkers) });
}
function download(data, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileBase = () => (S.sketch.name || 'map').replace(/[^\w\-]+/g, '_');

let autosaveTimer;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try { localStorage.setItem('mindscape-autosave', JSON.stringify(projectJSON(false))); } catch { /* storage full or blocked */ }
  }, 800);
}

// ---------------------------------------------------------------- Claude bridge
let lastInbox = Number(localStorage.getItem('mindscape-inbox') || 0);
async function pollInbox() {
  try {
    const r = await fetch('/api/inbox');
    const j = await r.json();
    if (j && j.mtime > lastInbox) {
      lastInbox = j.mtime;
      localStorage.setItem('mindscape-inbox', String(lastInbox));
      const d = j.data;
      toast(`🤖 Claude poslal návrh${d.note ? ': ' + d.note : ''}`, [['Načíst', () => loadInbox(d), 'primary'], ['Ignorovat']]);
    }
  } catch { /* bridge not available (static build) */ }
}
function loadInbox(d) {
  pushUndo(['sketch', 'map', 'locks']);
  if (d.type === 'spec') {
    S.sketch = rasterizeSpec(d.spec);
    if (d.spec.params || d.spec.seed) S.params = { ...structuredClone(DEFAULT_PARAMS), ...(d.spec.params ?? {}), seed: d.spec.seed ?? S.params.seed };
    if (d.keepLocks !== true) S.locks = new Map();
    afterLoad();
    generateNow(false);
  } else if (d.type === 'project') loadProject(d.project);
  else if (d.type === 'msav') loadMsavBytes(fromB64(d.msavBase64), d.name);
}
async function sendToClaude() {
  try {
    const body = { ...projectJSON(true), sentAt: new Date().toISOString() };
    const r = await fetch('/api/outbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.statusText);
    toast('Odesláno do .mindscape/outbox – napiš Claudovi, ať se podívá.');
  } catch (err) { toast('Bridge není dostupný (spusť editor přes npm run dev): ' + err.message); }
}

// ---------------------------------------------------------------- UI wiring
function spriteStyle(name, px) {
  const b = B[name];
  if (b?.sprites) {
    const [x, y] = b.sprites[0], k = px / catalog.tile / (b.size ?? 1);
    return `background-image:url(${atlasUrl});background-size:${atlas.width * k}px ${atlas.height * k}px;background-position:-${x * k}px -${y * k}px`;
  }
  return `background:rgb(${b?.color ?? [255, 0, 255]})`;
}

function buildTools() {
  const tools = S.mode === 'sketch' ? SKETCH_TOOLS : EDIT_TOOLS;
  if (!tools.some(([k]) => k === S.tool)) S.tool = 'brush';
  $('#tools').innerHTML = '';
  for (const [k, icon, name, key] of tools) {
    const b = document.createElement('button');
    b.innerHTML = `${icon}<small>${name}</small>`;
    b.title = `${name} (${key})`;
    b.className = S.tool === k ? 'active' : '';
    b.onclick = () => setTool(k);
    $('#tools').appendChild(b);
  }
  buildPalette();
  buildHint();
}
function setTool(k) {
  if (S.tool === 'path' && k !== 'path') pathPoints = [];
  S.tool = k; buildTools(); requestDraw();
}
function setMode(m) {
  S.mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  if (m === 'edit' && !S.map) toast('Nejdřív vygeneruj mapu.');
  buildTools(); requestDraw();
}

function buildPalette() {
  const pal = $('#palette');
  pal.innerHTML = '';
  pal.className = 'palette';
  $('#block-search').hidden = true; $('#block-tabs').hidden = true;
  if (S.mode === 'sketch' && S.tool === 'ore') {
    $('#palette-title').textContent = 'Ruda';
    for (const ore of Object.keys(ORES)) addSwatch(ore.replace('ore-', ''), spriteStyle(ore, 18), S.ore === ore, () => { S.ore = ore; buildPalette(); });
    return;
  }
  if (S.mode === 'sketch') {
    $('#palette-title').textContent = 'Paleta skici';
    for (const l of LABELS.slice(1)) {
      addSwatch(LABEL_NAMES[l.key] ?? l.key, `background:${l.color}`, S.label === l.key, () => { S.label = l.key; if (S.tool === 'erase') S.tool = 'brush'; buildTools(); }, l.kind);
    }
    return;
  }
  $('#palette-title').textContent = 'Bloky';
  $('#block-search').hidden = false; $('#block-tabs').hidden = false;
  const tabs = [['floor', 'Podlahy'], ['wall', 'Zdi'], ['overlay', 'Rudy'], ['prop', 'Dekorace']];
  $('#block-tabs').innerHTML = '';
  for (const [k, n] of tabs) {
    const b = document.createElement('button');
    b.textContent = n; b.className = S.blockTab === k ? 'active' : '';
    b.onclick = () => { S.blockTab = k; buildPalette(); };
    $('#block-tabs').appendChild(b);
  }
  pal.className = 'palette blocks';
  const q = S.blockQuery.toLowerCase();
  for (const [name, b] of Object.entries(B)) {
    if (b.kind !== S.blockTab || !b.sprites || name === 'spawn') continue;
    if (q && !name.includes(q)) continue;
    addSwatch(name, spriteStyle(name, 32), S.block === name, () => { S.block = name; if (!['brush', 'fill'].includes(S.tool)) S.tool = 'brush'; buildTools(); });
  }
}
function addSwatch(label, style, active, onclick, title) {
  const b = document.createElement('button');
  b.innerHTML = `<i class="sw" style="${style}"></i><span>${label}</span>`;
  b.className = active ? 'active' : '';
  b.title = title ? `${label} (${title})` : label;
  b.onclick = onclick;
  $('#palette').appendChild(b);
}
function buildHint() {
  const h = {
    brush: S.mode === 'sketch' ? 'Maluj hrubé oblasti. <b>Relativní</b> tvary jsou jen náznak a noise je přetvoří. <b>Fixní</b> zůstanou přesně tak, jak jsou nakreslené (přepínač <kbd>X</kbd>, fixní mají bílý obrys).' : 'Kresli vybraný blok. Upravené dlaždice se samy zamknou, takže je další generování nepřepíše.',
    erase: S.mode === 'sketch' ? 'Vrátí oblast na základní biom.' : 'Smaže zdi, dekorace a rudy.',
    fill: S.mode === 'edit' ? 'Vyplní souvislou oblast. <kbd>Shift</kbd>+klik nahradí všechny stejné dlaždice v celé mapě.' : 'Vyplní souvislou oblast.',
    line: 'Táhni myší pro rovnou čáru (šířka = štětec).',
    spray: 'Náhodně rozprašuje vybraný blok, hodí se na balvany a rudy.',
    path: 'Klikáním přidávej body řeky, dvojklik nebo <kbd>Enter</kbd> ji dokončí, <kbd>Esc</kbd> zruší. Šířku určuje štětec.',
    rect: 'Táhni myší.', ellipse: 'Táhni myší.',
    core: 'Klik = tvoje core, <kbd>Shift</kbd>+klik = nepřátelské core, <kbd>Alt</kbd>+klik = smazat. Se symetrií vzniknou PvP core.',
    spawn: 'Klik = spawn nepřátel, <kbd>Alt</kbd>+klik = smazat.',
    ore: 'Klik = ložisko vybrané rudy (velikost = štětec), <kbd>Alt</kbd>+klik = smazat.',
    picker: 'Klikni na dlaždici a vezmi její blok.',
    lock: 'Zamčené dlaždice zůstanou při dalším generování beze změny.',
    unlock: 'Odemčené dlaždice se při dalším generování přepíšou.',
    pan: 'Táhni pro posun. Kdykoli funguje i prostřední nebo pravé tlačítko a <kbd>Space</kbd>.',
  }[S.tool] ?? '';
  $('#hint').innerHTML = `${h}<br><br><kbd>Tab</kbd> skica/úpravy · <kbd>G</kbd> generovat · <kbd>Shift+G</kbd> nový seed · <kbd>[</kbd> <kbd>]</kbd> štětec · <kbd>H</kbd> skica přes mapu · kolečko = zoom`;
}

function syncParamsUI() {
  const box = $('#params');
  if (!box.childElementCount) {
    for (const [k, name, min, max, step, tip] of PARAMS) {
      const d = document.createElement('div');
      d.className = 'param'; d.title = tip;
      d.innerHTML = `<div class="top"><span>${name}</span><b data-v="${k}"></b></div><input type="range" min="${min}" max="${max}" step="${step}" data-p="${k}">`;
      box.appendChild(d);
    }
    for (const [k, name] of PARAM_CHECKS) {
      const l = document.createElement('label');
      l.className = 'row check';
      l.innerHTML = `<input type="checkbox" data-p="${k}"> ${name}`;
      box.appendChild(l);
    }
    const sh = document.createElement('div');
    sh.className = 'shores';
    sh.innerHTML = '<div class="small">Pláže a přechody u:</div>' + Object.entries(SHORE_NAMES).map(([k, n]) => `<label class="check"><input type="checkbox" data-shore="${k}"> ${n}</label>`).join('');
    box.appendChild(sh);
    box.addEventListener('input', (e) => {
      if (e.target.dataset.shore) {
        S.params.shores = { ...DEFAULT_PARAMS.shores, ...S.params.shores, [e.target.dataset.shore]: e.target.checked };
        scheduleAutosave();
        if (S.autoGen) { clearTimeout(genTimer); genTimer = setTimeout(() => generateNow(false), 150); }
        return;
      }
      const k = e.target.dataset.p;
      if (!k) return;
      S.params[k] = e.target.type === 'checkbox' ? e.target.checked : +e.target.value;
      box.querySelector(`[data-v="${k}"]`)?.replaceChildren(String(S.params[k]));
      scheduleAutosave();
      if (S.autoGen) { clearTimeout(genTimer); genTimer = setTimeout(() => generateNow(false), 250); }
    });
    box.addEventListener('pointerdown', (e) => { if (e.target.dataset.p || e.target.dataset.shore) pushUndo(['map']); });
  }
  for (const el of box.querySelectorAll('[data-shore]')) el.checked = ({ ...DEFAULT_PARAMS.shores, ...S.params.shores })[el.dataset.shore] !== false;
  for (const el of box.querySelectorAll('[data-p]')) {
    const k = el.dataset.p;
    if (el.type === 'checkbox') el.checked = !!S.params[k]; else el.value = S.params[k];
    box.querySelector(`[data-v="${k}"]`)?.replaceChildren(String(S.params[k]));
  }
  $('#seed').value = S.params.seed;
}
function syncMapUI() {
  $('#map-name').value = S.sketch.name ?? '';
  $('#map-author').value = S.sketch.author ?? '';
  $('#map-desc').value = S.sketch.description ?? '';
  $('#base-biome').value = S.sketch.base;
  $('#map-size').textContent = `${W()} × ${H()} dlaždic`;
}

function initUI() {
  for (const sel of [$('#base-biome'), document.querySelector('#new-dialog select[name=base]')]) {
    for (const k of Object.keys(BIOMES)) sel.add(new Option(LABEL_NAMES[k] ?? k, k));
  }
  $('#new-dialog select[name=base]').value = 'stone';
  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.mode) setMode(t.dataset.mode);
    if (t.dataset.reroll) reroll(t.dataset.reroll);
    switch (t.dataset.action) {
      case 'new': $('#new-dialog').showModal(); break;
      case 'open': $('#file-input').click(); break;
      case 'import-image': $('#image-input').click(); break;
      case 'resize': {
        const f = $('#resize-dialog form');
        f.w.value = W(); f.h.value = H();
        $('#resize-dialog').showModal();
        break;
      }
      case 'flip-x': flipAll('x'); break;
      case 'flip-y': flipAll('y'); break;
      case 'save-project': download(JSON.stringify(projectJSON(true)), fileBase() + '.mindscape.json', 'application/json'); break;
      case 'export': if (S.map) download(exportMsav(), fileBase() + '.msav', 'application/octet-stream'); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'generate': generateNow(); break;
      case 'reroll-all': reroll('all'); break;
      case 'send-claude': sendToClaude(); break;
      case 'lock-all': if (S.map) { pushUndo(['locks']); for (let i = 0; i < W() * H(); i++) lockTile(i); updateLockLayer(); } break;
      case 'unlock-all': pushUndo(['locks']); S.locks = new Map(); updateLockLayer(); break;
      case 'beautify':
        if (!S.map) break;
        pushUndo(['sketch', 'map', 'locks']);
        S.sketch = Object.assign(deriveSketch(S.map, catalog), { name: S.sketch.name, author: S.sketch.author });
        S.locks = new Map(); updateSketchLayer(); updateLockLayer(); generateNow(false);
        break;
    }
  });
  $('#new-dialog').addEventListener('close', () => {
    if ($('#new-dialog').returnValue !== 'ok') return;
    const f = new FormData($('#new-dialog form'));
    newProject(clamp(+f.get('w'), 50, 1000), clamp(+f.get('h'), 50, 1000), f.get('base'), f.get('island') === 'on');
  });
  $('#file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    try {
      if (file.name.endsWith('.json')) {
        const j = JSON.parse(new TextDecoder().decode(bytes));
        if (j.format === 'mindscape-project' || j.format === 'mapforge-project') loadProject(j);
        else { S.sketch = rasterizeSpec(j); S.params = { ...structuredClone(DEFAULT_PARAMS), ...(j.params ?? {}), seed: j.seed ?? 1 }; S.locks = new Map(); afterLoad(); generateNow(false); }
      } else loadMsavBytes(bytes, file.name.replace(/\.msav$/, ''));
    } catch (err) { toast('Soubor nejde načíst: ' + err.message); console.error(err); }
    e.target.value = '';
  });
  $('#image-input').addEventListener('change', (e) => { if (e.target.files[0]) openImageDialog(e.target.files[0]); e.target.value = ''; });
  $('#image-dialog').addEventListener('close', () => { if ($('#image-dialog').returnValue === 'ok' && pendingImage) applyImage($('#image-dialog form')); });
  {
    const f = $('#image-dialog form');
    const keep = (from) => {
      if (!f.aspect.checked || !pendingImage) return;
      const { img } = pendingImage;
      if (from === 'w') f.h.value = Math.round((f.w.value * img.height) / img.width); else f.w.value = Math.round((f.h.value * img.width) / img.height);
    };
    f.w.addEventListener('input', () => keep('w'));
    f.h.addEventListener('input', () => keep('h'));
    for (const k of Object.keys(BIOMES)) f.base.add(new Option(LABEL_NAMES[k] ?? k, k));
  }
  $('#resize-dialog').addEventListener('close', () => {
    if ($('#resize-dialog').returnValue !== 'ok') return;
    const f = $('#resize-dialog form');
    resizeAll(clamp(+f.w.value, 20, 2000), clamp(+f.h.value, 20, 2000), f.ax.value, f.ay.value);
  });
  $('#map-desc').addEventListener('input', (e) => { S.sketch.description = e.target.value; scheduleAutosave(); });
  $('#bg-opacity').addEventListener('input', (e) => { S.bgOpacity = e.target.value / 100; requestDraw(); });
  const syncFixed = () => document.querySelectorAll('[data-fixed]').forEach((b) => b.classList.toggle('active', (b.dataset.fixed === '1') === S.fixedMode));
  document.querySelectorAll('[data-fixed]').forEach((b) => b.addEventListener('click', () => { S.fixedMode = b.dataset.fixed === '1'; syncFixed(); }));
  window.__syncFixed = syncFixed;
  $('#brush-shape').addEventListener('change', (e) => { S.brushShape = e.target.value; requestDraw(); });
  $('#brush').addEventListener('input', (e) => { S.brush = +e.target.value; $('#brush-val').textContent = S.brush; requestDraw(); });
  $('#symmetry').addEventListener('change', (e) => { S.symmetry = e.target.value; requestDraw(); });
  $('#block-search').addEventListener('input', (e) => { S.blockQuery = e.target.value; buildPalette(); });
  $('#seed').addEventListener('change', (e) => { pushUndo(['map']); S.params.seed = +e.target.value; S.params.seeds = {}; generateNow(false); });
  $('#map-name').addEventListener('input', (e) => { S.sketch.name = e.target.value; scheduleAutosave(); });
  $('#map-author').addEventListener('input', (e) => { S.sketch.author = e.target.value; scheduleAutosave(); });
  $('#base-biome').addEventListener('change', (e) => { pushUndo(['sketch']); S.sketch.base = e.target.value; updateSketchLayer(); afterSketchChange(); });
  $('#auto-gen').addEventListener('change', (e) => (S.autoGen = e.target.checked));
  $('#sketch-opacity').addEventListener('input', (e) => { S.sketchOpacity = e.target.value / 100; requestDraw(); });
  $('#show-locks').addEventListener('change', (e) => { S.showLocks = e.target.checked; requestDraw(); });
  $('#show-grid').addEventListener('change', (e) => { S.showGrid = e.target.checked; requestDraw(); });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches?.('input[type=text], input[type=number], input[type=search]')) return;
    const k = e.key.toLowerCase();
    if (e.ctrlKey || e.metaKey) {
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
      if (k === 's') { e.preventDefault(); download(JSON.stringify(projectJSON(true)), fileBase() + '.mindscape.json', 'application/json'); }
      return;
    }
    if (k === ' ') { spaceDown = true; e.preventDefault(); return; }
    if (k === 'tab') { e.preventDefault(); setMode(S.mode === 'sketch' ? 'edit' : 'sketch'); return; }
    if (k === 'enter' && S.tool === 'path') return finishPath();
    if (k === 'escape') { pathPoints = []; requestDraw(); return; }
    if (k === 'g') return e.shiftKey ? reroll('all') : generateNow();
    if (k === '[' || k === ']') { S.brush = clamp(S.brush + (k === ']' ? 1 : -1) * Math.max(1, Math.round(S.brush / 6)), 1, 40); $('#brush').value = S.brush; $('#brush-val').textContent = S.brush; requestDraw(); return; }
    if (k === 'h') { S.sketchOpacity = S.sketchOpacity > 0 ? 0 : 0.5; $('#sketch-opacity').value = S.sketchOpacity * 100; requestDraw(); return; }
    if (k === '0') return fitView();
    if (k === 'x' && S.mode === 'sketch') { S.fixedMode = !S.fixedMode; window.__syncFixed(); toast(S.fixedMode ? 'Fixní tvary – zůstanou přesně tak, jak jsou nakreslené' : 'Relativní tvary – náznak pro noise'); return; }
    const tools = S.mode === 'sketch' ? SKETCH_TOOLS : EDIT_TOOLS;
    const t = tools.find(([, , , key]) => key.toLowerCase() === k);
    if (t) setTool(t[0]);
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') spaceDown = false; });
}

// ---------------------------------------------------------------- background image, resize, flip
function setBackground(bg) {
  if (!bg) { S.bg = null; return; }
  const img = new Image();
  img.onload = requestDraw;
  img.src = bg.url;
  S.bg = { ...bg, img };
}

function resizeAll(nw, nh, ax, ay) {
  pushUndo(['all']);
  const ow = W(), oh = H();
  const dx = ax === 'left' ? 0 : ax === 'right' ? nw - ow : Math.floor((nw - ow) / 2);
  const dy = ay === 'bottom' ? 0 : ay === 'top' ? nh - oh : Math.floor((nh - oh) / 2);
  const move = (i) => { const x = (i % ow) + dx, y = ((i / ow) | 0) + dy; return x >= 0 && y >= 0 && x < nw && y < nh ? y * nw + x : -1; };
  // new space continues whatever is at the old map edge (rock stays rock, land stays land)
  const sk = S.sketch, labels = new Uint8Array(nw * nh), fixed = new Uint8Array(nw * nh);
  for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
    const sx = clamp(x - dx, 0, ow - 1), sy = clamp(y - dy, 0, oh - 1);
    labels[y * nw + x] = sk.labels[sy * ow + sx];
    fixed[y * nw + x] = sk.fixed[sy * ow + sx];
  }
  sk.fixed = fixed;
  const inside = ([x, y]) => x >= 0 && y >= 0 && x < nw && y < nh;
  const shift = ([x, y]) => [x + dx, y + dy];
  sk.labels = labels; sk.width = nw; sk.height = nh;
  sk.cores = sk.cores.map((c) => ({ ...c, pos: shift(c.pos) })).filter((c) => inside(c.pos));
  sk.spawns = sk.spawns.map(shift).filter(inside);
  sk.ores = sk.ores.map((o) => ({ ...o, center: shift(o.center) })).filter((o) => inside(o.center));
  if (S.map) {
    const m = S.map, n = { ...m, width: nw, height: nh, floor: new Array(nw * nh).fill(sk.base === 'void' ? 'empty' : BIOMES[sk.base]?.base ?? 'stone'), overlay: new Array(nw * nh).fill('air'), block: new Array(nw * nh).fill('air'), buildings: new Map() };
    for (let i = 0; i < ow * oh; i++) { const j = move(i); if (j >= 0) { n.floor[j] = m.floor[i]; n.overlay[j] = m.overlay[i]; n.block[j] = m.block[i]; } }
    for (const [i, b] of m.buildings) { const j = move(i); if (j >= 0) n.buildings.set(j, b); }
    S.map = n;
  }
  const locks = new Map();
  for (const [i, t] of S.locks) { const j = move(i); if (j >= 0) locks.set(j, t); }
  S.locks = locks;
  if (S.bg) S.bg.rect = [S.bg.rect[0] + dx, S.bg.rect[1] + dy, S.bg.rect[2], S.bg.rect[3]];
  afterLoad();
  if (S.autoGen) generateNow(false);
  scheduleAutosave();
}

function flipAll(axis) {
  pushUndo(['all']);
  const w = W(), h = H();
  const f = (i) => { const x = i % w, y = (i / w) | 0; return axis === 'x' ? y * w + (w - 1 - x) : (h - 1 - y) * w + x; };
  const fp = ([x, y]) => (axis === 'x' ? [w - 1 - x, y] : [x, h - 1 - y]);
  const sk = S.sketch, labels = new Uint8Array(w * h);
  const fixed = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { labels[f(i)] = sk.labels[i]; fixed[f(i)] = sk.fixed[i]; }
  sk.labels = labels; sk.fixed = fixed;
  sk.cores = sk.cores.map((c) => ({ ...c, pos: fp(c.pos) }));
  sk.spawns = sk.spawns.map(fp);
  sk.ores = sk.ores.map((o) => ({ ...o, center: fp(o.center) }));
  if (S.map) {
    const m = S.map;
    for (const layer of ['floor', 'overlay', 'block']) { const a = new Array(w * h); for (let i = 0; i < w * h; i++) a[f(i)] = m[layer][i]; m[layer] = a; }
    const b = new Map(); for (const [i, v] of m.buildings) b.set(f(i), v); m.buildings = b;
  }
  const locks = new Map(); for (const [i, t] of S.locks) locks.set(f(i), t); S.locks = locks;
  if (S.bg) { const [bx, by, bw, bh] = S.bg.rect; if (axis === 'x') { S.bg.flipX = !S.bg.flipX; S.bg.rect = [w - bx - bw, by, bw, bh]; } else { S.bg.flipY = !S.bg.flipY; S.bg.rect = [bx, h - by - bh, bw, bh]; } }
  resetChunks(); updateSketchLayer(); updateLockLayer(); requestDraw(); scheduleAutosave();
}

let pendingImage = null; // {url, img}
async function openImageDialog(file) {
  const url = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
  const img = new Image();
  img.src = url;
  await img.decode();
  pendingImage = { url, img };
  const d = $('#image-dialog'), form = d.querySelector('form');
  $('#image-preview').src = url;
  form.w.value = S.sketch ? W() : 200;
  form.h.value = Math.round((form.w.value * img.height) / img.width);
  form.base.value = S.sketch?.base ?? 'stone';
  d.showModal();
}
function applyImage(form) {
  const { url, img } = pendingImage;
  const w = clamp(+form.w.value, 20, 2000), h = clamp(+form.h.value, 20, 2000);
  pushUndo(['all']);
  if (form.replace.checked) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const data = g.getImageData(0, 0, img.width, img.height).data;
    S.sketch = emptySketch(w, h, form.base.value);
    if (form.walls.checked) {
      S.sketch.labels = imageToLabels(data, img.width, img.height, w, h, { closeGaps: +form.close.value, lineWidth: +form.line.value });
      if (form.fixedWalls.checked) for (let i = 0; i < w * h; i++) S.sketch.fixed[i] = S.sketch.labels[i] ? 1 : 0;
    }
    S.sketch.name = S.sketch.name || 'Nová mapa';
    S.map = null; S.locks = new Map();
    setBackground({ url, rect: [0, 0, w, h] });
    afterLoad();
    generateNow(false);
  } else {
    setBackground({ url, rect: [0, 0, W(), H()] });
    requestDraw();
  }
  if (S.bgOpacity === 0) { S.bgOpacity = 0.4; $('#bg-opacity').value = 40; }
  scheduleAutosave();
  toast('Skica načtena. Core a spawny si polož nástroji v režimu Skica, průhlednost obrázku je v panelu Zobrazení.');
}

// ---------------------------------------------------------------- boot
async function boot() {
  const img = new Image();
  img.src = '/atlas.png';
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  atlas = { width: img.width, height: img.height, data: g.getImageData(0, 0, img.width, img.height).data };
  atlasUrl = img.src;

  initUI();
  buildTools();
  let restored = false;
  try {
    const saved = JSON.parse(localStorage.getItem('mindscape-autosave') ?? localStorage.getItem('mapforge-autosave'));
    if (saved?.format === 'mindscape-project' || saved?.format === 'mapforge-project') { loadProject(saved); restored = true; status('Obnoven poslední projekt'); }
  } catch { /* ignore */ }
  if (!restored) newProject(200, 200, 'stone', true);
  pollInbox();
  setInterval(pollInbox, 2500);
}
boot();
