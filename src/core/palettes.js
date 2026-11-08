// Serpulo biome and liquid palettes. Derived from floor-adjacency stats of the campaign maps
// (data/adjacency.json): e.g. deep-water > shallow-water > sand-water > sand-floor is the dominant chain.
//
// Biome "layers" share a noise field when they use the same `noise` key; increasing thresholds on one
// field produce nested, concentric transitions (snow > ice-snow > ice) instead of random blotches.

export const BIOMES = {
  sand: {
    color: '#d9b391', base: 'sand-floor', wall: 'sand-wall', beach: 'sand-floor',
    layers: [
      { noise: 'a', scale: 46, floor: 'darksand', threshold: 0.74 },
      { noise: 'a', scale: 46, floor: 'basalt', threshold: 0.9 },
      { noise: 'c', scale: 18, floor: 'stone', threshold: 0.92 },
    ],
  },
  darksand: {
    color: '#3f3c3c', base: 'darksand', wall: 'dune-wall', beach: 'darksand',
    layers: [
      { noise: 'a', scale: 36, floor: 'basalt', threshold: 0.7 },
      { noise: 'b', scale: 30, floor: 'shale', threshold: 0.8 },
      { noise: 'b', scale: 30, floor: 'sand-floor', threshold: 0.92 },
    ],
  },
  stone: {
    color: '#56565d', base: 'stone', wall: 'stone-wall', beach: 'sand-floor',
    layers: [
      { noise: 'a', scale: 44, floor: 'darksand', threshold: 0.72 },
      { noise: 'a', scale: 44, floor: 'sand-floor', threshold: 0.84 },
      { noise: 'b', scale: 16, floor: 'crater-stone', threshold: 0.72 },
      { noise: 'c', scale: 9, floor: 'char', threshold: 0.93 },
    ],
  },
  grass: {
    color: '#6eac5f', base: 'grass', wall: 'shrubs', beach: 'sand-floor', tree: 'pine',
    layers: [
      { noise: 'a', scale: 40, floor: 'dirt', threshold: 0.78 },
      { noise: 'a', scale: 40, floor: 'mud', threshold: 0.9 },
    ],
  },
  snow: {
    color: '#e9eff4', base: 'snow', wall: 'snow-wall', beach: 'ice', tree: 'snow-pine',
    layers: [
      { noise: 'a', scale: 36, floor: 'ice-snow', threshold: 0.62 },
      { noise: 'a', scale: 36, floor: 'ice', threshold: 0.82 },
      { noise: 'b', scale: 30, floor: 'shale', threshold: 0.9 },
    ],
  },
  ice: {
    color: '#d3d2fd', base: 'ice', wall: 'ice-wall', beach: 'ice',
    layers: [
      { noise: 'a', scale: 30, floor: 'ice-snow', threshold: 0.55 },
      { noise: 'a', scale: 30, floor: 'snow', threshold: 0.8 },
    ],
  },
  moss: {
    color: '#704678', base: 'moss', wall: 'spore-pine', beach: 'darksand',
    layers: [
      { noise: 'a', scale: 34, floor: 'spore-moss', threshold: 0.55 },
      { noise: 'b', scale: 28, floor: 'darksand', threshold: 0.86 },
    ],
  },
  spore: {
    color: '#714988', base: 'spore-moss', wall: 'spore-wall', beach: 'darksand',
    layers: [
      { noise: 'a', scale: 30, floor: 'moss', threshold: 0.65 },
      { noise: 'b', scale: 24, floor: 'darksand', threshold: 0.9 },
    ],
  },
  shale: {
    color: '#605c84', base: 'shale', wall: 'shale-wall', beach: 'sand-floor',
    layers: [
      { noise: 'a', scale: 40, floor: 'darksand', threshold: 0.72 },
      { noise: 'a', scale: 40, floor: 'sand-floor', threshold: 0.87 },
    ],
  },
  basalt: {
    color: '#5a4038', base: 'basalt', wall: 'dune-wall', beach: 'darksand',
    layers: [
      { noise: 'a', scale: 38, floor: 'darksand', threshold: 0.72 },
      { noise: 'b', scale: 22, floor: 'hotrock', threshold: 0.87 },
      { noise: 'b', scale: 22, floor: 'magmarock', threshold: 0.955 },
    ],
  },
  salt: {
    color: '#f5f6f9', base: 'salt', wall: 'salt-wall', beach: 'sand-floor',
    layers: [
      { noise: 'a', scale: 34, floor: 'sand-floor', threshold: 0.74 },
      { noise: 'a', scale: 34, floor: 'darksand', threshold: 0.92 },
    ],
  },
  dirt: {
    color: '#684037', base: 'dirt', wall: 'dirt-wall', beach: 'mud',
    layers: [
      { noise: 'a', scale: 30, floor: 'mud', threshold: 0.72 },
      { noise: 'b', scale: 40, floor: 'grass', threshold: 0.82 },
    ],
  },
};

// inner: bands from the liquid edge inwards [{floor, depth}] - floor used when depth >= value (last match wins)
// shore: bands from the edge outwards; `mix` = use biome-specific shallow-mix floor, `beach` = biome beach floor
export const LIQUIDS = {
  water: {
    color: '#5c6dba',
    inner: [{ floor: 'shallow-water', depth: 0 }, { floor: 'deep-water', depth: 4 }],
    shore: [{ floor: 'mix', width: 1.6 }, { floor: 'beach', width: 3.2 }],
  },
  tainted: {
    color: '#5a3e6e',
    inner: [{ floor: 'tainted-water', depth: 0 }, { floor: 'deep-tainted-water', depth: 4 }],
    shore: [{ floor: 'darksand-tainted-water', width: 1.6 }, { floor: 'darksand', width: 3 }],
  },
  slag: {
    color: '#ff8142',
    inner: [{ floor: 'molten-slag', depth: 0 }],
    shore: [{ floor: 'magmarock', width: 1.4 }, { floor: 'hotrock', width: 2.2 }, { floor: 'basalt', width: 3 }],
  },
  tar: {
    color: '#1d201f',
    inner: [{ floor: 'tar', depth: 0 }],
    shore: [{ floor: 'darksand', width: 2.2 }, { floor: 'shale', width: 2.5 }],
  },
  cryo: {
    color: '#87ceeb',
    inner: [{ floor: 'pooled-cryofluid', depth: 0 }],
    shore: [{ floor: 'ice', width: 2 }, { floor: 'ice-snow', width: 2 }],
  },
};

// shallow mix floor for water next to a beach floor
export const WATER_MIX = { 'sand-floor': 'sand-water', darksand: 'darksand-water', default: 'sand-water' };

// Label ids used in sketch grids. 0 = "not painted" (falls back to the base biome).
export const LABELS = [
  { id: 0, key: 'none', kind: 'none', color: '#00000000' },
  { id: 1, key: 'wall', kind: 'wall', color: '#26262b' },
  { id: 2, key: 'void', kind: 'void', color: '#000000' },
  ...Object.entries(BIOMES).map(([k, b], i) => ({ id: 3 + i, key: k, kind: 'land', color: b.color })),
];
for (const [k, l] of Object.entries(LIQUIDS)) LABELS.push({ id: LABELS.length, key: k, kind: 'liquid', color: l.color });
export const LABEL = Object.fromEntries(LABELS.map((l) => [l.key, l]));

// Ore distribution: `coverage` = fraction of open land, `near` = preferred distance from the core
// (fraction of the map diagonal), `scale` = vein size in tiles. Later entries overwrite earlier ones.
export const ORES = {
  'ore-copper': { scale: 20, coverage: 0.03, near: 0.1 },
  'ore-lead': { scale: 20, coverage: 0.026, near: 0.15 },
  'ore-scrap': { scale: 16, coverage: 0.01, near: 0.3 },
  'ore-coal': { scale: 18, coverage: 0.018, near: 0.3 },
  'ore-titanium': { scale: 18, coverage: 0.016, near: 0.45 },
  'ore-thorium': { scale: 16, coverage: 0.01, near: 0.7 },
};
