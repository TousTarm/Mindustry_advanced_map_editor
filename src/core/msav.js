// Reader/writer for Mindustry .msav map files. Works in Node and the browser (uses pako).
// Format: zlib( "MSAV" int(version) chunk* ), chunk = int(length) + bytes.
import * as pako from 'pako';

const HEADER = [77, 83, 65, 86]; // "MSAV"
export const WRITE_VERSION = 11; // v11 has the simplest patch chunk and loads in all current builds
const CONTENT_BLOCK = 1; // ContentType.block ordinal

class Reader {
  constructor(bytes) {
    this.b = bytes;
    this.v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.p = 0;
  }
  u8() { return this.b[this.p++]; }
  i8() { return this.v.getInt8(this.p++); }
  u16() { const r = this.v.getUint16(this.p); this.p += 2; return r; }
  i16() { const r = this.v.getInt16(this.p); this.p += 2; return r; }
  i32() { const r = this.v.getInt32(this.p); this.p += 4; return r; }
  bytes(n) { const r = this.b.subarray(this.p, this.p + n); this.p += n; return r; }
  utf() { const n = this.u16(); return new TextDecoder().decode(this.bytes(n)); }
  chunk() { const n = this.i32(); return this.bytes(n); }
}

class Writer {
  constructor() { this.buf = new Uint8Array(1 << 16); this.p = 0; }
  ensure(n) {
    if (this.p + n <= this.buf.length) return;
    let len = this.buf.length * 2;
    while (len < this.p + n) len *= 2;
    const nb = new Uint8Array(len); nb.set(this.buf.subarray(0, this.p)); this.buf = nb;
  }
  u8(x) { this.ensure(1); this.buf[this.p++] = x & 255; }
  u16(x) { this.ensure(2); this.buf[this.p++] = (x >> 8) & 255; this.buf[this.p++] = x & 255; }
  i32(x) { this.ensure(4); for (let s = 24; s >= 0; s -= 8) this.buf[this.p++] = (x >>> s) & 255; }
  bytes(a) { this.ensure(a.length); this.buf.set(a, this.p); this.p += a.length; }
  utf(s) { const e = new TextEncoder().encode(s); this.u16(e.length); this.bytes(e); }
  chunk(fn) { const w = new Writer(); fn(w); this.i32(w.p); this.bytes(w.out()); }
  out() { return this.buf.subarray(0, this.p); }
}

function readStringMap(r) {
  const n = r.i16(), m = {};
  for (let i = 0; i < n; i++) m[r.utf()] = r.utf();
  return m;
}

function readContentHeader(r) {
  const mapped = r.u8(), out = {};
  for (let i = 0; i < mapped; i++) {
    const type = r.i8(), total = r.i16(), names = [];
    for (let j = 0; j < total; j++) names.push(r.utf());
    out[type] = names;
  }
  return out;
}

/**
 * Parsed map: { version, tags, width, height, floor[], overlay[], block[] (names, indexed y*w+x),
 *   buildings: Map<index, {team, raw}> for building centers, raw: chunks we keep as-is }.
 */
export function readMsav(fileBytes) {
  const data = pako.inflate(fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes));
  const r = new Reader(data);
  for (const h of HEADER) if (r.u8() !== h) throw new Error('Not an MSAV file');
  const version = r.i32();
  if (version < 4) throw new Error(`Save version ${version} is too old`);

  const tags = readStringMap(new Reader(r.chunk()));
  let content;
  if (version >= 12) r.chunk(); // patches
  content = readContentHeader(new Reader(r.chunk()));
  if (version === 11) r.chunk(); // patches
  const mapChunk = new Reader(r.chunk());
  const rest = []; // entities, markers, custom...
  while (r.p < data.length) rest.push(r.chunk());

  const blocks = content[CONTENT_BLOCK];
  const name = (id) => blocks[id] ?? 'air';
  const shortChunks = version < 10;

  const m = mapChunk;
  const width = m.u16(), height = m.u16(), len = width * height;
  const floor = new Array(len), overlay = new Array(len), block = new Array(len);
  for (let i = 0; i < len; i++) {
    const f = m.i16(), o = m.i16(), c = m.u8();
    for (let j = i; j <= i + c; j++) { floor[j] = name(f); overlay[j] = name(o); }
    i += c;
  }

  const buildings = new Map();
  const tileData = new Map();
  for (let i = 0; i < len; i++) {
    const b = name(m.i16());
    const packed = m.i8();
    const hadEntity = (packed & 1) !== 0, hadDataOld = (packed & 2) !== 0, hadData = (packed & 4) !== 0;
    block[i] = b;
    if (hadData) tileData.set(i, m.bytes(7).slice());
    if (hadEntity) {
      const center = m.u8() !== 0;
      if (center) {
        const n = shortChunks ? m.u16() : m.i32();
        const raw = m.bytes(n).slice();
        // raw = revision byte + building data; team is byte 6 (after revision, f32 health, rotation byte)
        buildings.set(i, { team: raw[6], raw });
      } else {
        block[i] = '@part'; // filled by multiblock
      }
    } else if (hadDataOld && shortChunks) {
      m.u8();
    } else if (!hadData && !hadDataOld) {
      const c = m.u8();
      for (let j = i + 1; j <= i + c; j++) block[j] = b;
      i += c;
    }
  }

  return { version, tags, width, height, floor, overlay, block, buildings, tileData, contentNames: content };
}

// ---------- writing ----------

/**
 * Write a map. `map` uses the same shape readMsav returns. Block names must exist in `blockNames`
 * (the full content list of the current game; see data/blocks.json).
 */
export function writeMsav(map, blockNames, templates) {
  const ids = new Map(blockNames.map((n, i) => [n, i]));
  const id = (n) => {
    if (n === '@part') return ids.get('air');
    const v = ids.get(n);
    if (v === undefined) throw new Error(`Unknown block: ${n}`);
    return v;
  };
  const { width, height } = map, len = width * height;

  const w = new Writer();
  HEADER.forEach((h) => w.u8(h));
  w.i32(WRITE_VERSION);

  const tags = { ...map.tags, width: String(width), height: String(height) };
  w.chunk((o) => {
    const e = Object.entries(tags);
    o.u16(e.length);
    for (const [k, v] of e) { o.utf(k); o.utf(String(v)); }
  });

  // content header: only blocks are needed for a map
  w.chunk((o) => {
    o.u8(1); o.u8(CONTENT_BLOCK); o.u16(blockNames.length);
    for (const n of blockNames) o.utf(n);
  });

  // v11 patches: u8 count
  w.chunk((o) => o.u8(0));

  // map
  w.chunk((o) => {
    o.u16(width); o.u16(height);
    for (let i = 0; i < len; i++) {
      const f = id(map.floor[i]), ov = id(map.overlay[i]);
      let c = 0;
      while (i + c + 1 < len && c < 255 && map.floor[i + c + 1] === map.floor[i] && map.overlay[i + c + 1] === map.overlay[i]) c++;
      o.u16(f); o.u16(ov); o.u8(c);
      i += c;
    }

    // which tiles are covered by multiblock buildings
    const owner = new Int32Array(len).fill(-1);
    for (const [ci, bld] of map.buildings) {
      const size = templates?.[map.block[ci]]?.size ?? 1;
      const off = -Math.floor((size - 1) / 2);
      const cx = ci % width, cy = Math.floor(ci / width);
      for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) {
        const x = cx + dx + off, y = cy + dy + off;
        if (x >= 0 && y >= 0 && x < width && y < height) owner[y * width + x] = ci;
      }
    }

    for (let i = 0; i < len; i++) {
      const own = owner[i];
      if (own >= 0) {
        const bld = map.buildings.get(own);
        o.u16(id(map.block[own])); o.u8(1);
        if (own === i) {
          o.u8(1);
          const raw = bld.raw.slice();
          raw[6] = bld.team;
          o.i32(raw.length); o.bytes(raw);
        } else o.u8(0);
        continue;
      }
      const b = map.block[i] === '@part' ? 'air' : map.block[i];
      const td = map.tileData?.get(i);
      if (td) { o.u16(id(b)); o.u8(4); o.bytes(td); continue; }
      let c = 0;
      while (i + c + 1 < len && c < 255 && owner[i + c + 1] < 0 && !map.tileData?.get(i + c + 1)
        && (map.block[i + c + 1] === '@part' ? 'air' : map.block[i + c + 1]) === b) c++;
      o.u16(id(b)); o.u8(0); o.u8(c);
      i += c;
    }
  });

  // entities: no custom entity mapping, team block plans for sharded (empty), no world entities
  w.chunk((o) => { o.u16(0); o.i32(1); o.i32(1); o.i32(0); o.i32(0); });
  // markers: empty UBJSON object "{}" as written by JsonIO.writeBytes
  w.chunk((o) => o.bytes(templates?.emptyMarkers ?? new Uint8Array([0x7b, 0x7d])));
  // custom chunks: none
  w.chunk((o) => o.i32(0));

  return pako.deflate(w.out());
}
