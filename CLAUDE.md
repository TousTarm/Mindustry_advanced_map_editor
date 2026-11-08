# MapForge – notes for Claude

Standalone Mindustry (Serpulo) map editor + generator. The Mindustry source in `../Mindustry_map_editor-master`
is reference only (block list, sprites, save format); MapForge does not depend on it at runtime.

## Layout
- `src/core/` – isomorphic JS (Node + browser):
  - `msav.js` read/write `.msav` (writes save version 11, all current builds load it)
  - `generate.js` sketch → map pipeline (domain warp → liquid depth/shore bands → biome floors with nested
    noise layers → rocks + cellular automata → guaranteed spawn→core paths → boulders/trees/ores → cores/spawns).
    Every stage has its own seed (`params.seeds.{shape,floor,rocks,ores,deco}`) so one layer can be rerolled.
  - `palettes.js` biomes, liquids, ores, sketch labels. Tune the look here.
  - `sketch.js` spec shapes → label grid; `project.js` RLE, `deriveSketch` (map → sketch, for "beautify"), locks.
  - `render.js` sprite renderer incl. in-game wall darkness.
- `src/cli.js` – CLI (below). `web/` – Vite editor (`npm run dev`, port 5178). `data/` – generated catalog/templates.
- `scripts/build-catalog.mjs`, `scripts/extract-templates.mjs` – rebuild `data/` + `public/atlas.png` (`npm run catalog`).

## Designing maps for the user (the API)
1. Write a spec JSON (see `node src/cli.js labels` and `examples/*.json`). Coordinates are tiles, y up, (0,0) bottom-left.
   Shapes: `fill`, `rect`, `circle`/`ellipse`, `polygon`, `path` (rivers, width number or [start,end]). Later shapes paint over earlier ones.
2. `node src/cli.js sketch spec.json` to check the layout, `node src/cli.js gen spec.json --scale 4` to generate,
   then **look at the PNG** and iterate (params via `--set rocks=0.3`, seeds via `--seed`).
3. `node src/cli.js push spec.json --note "..."` sends it to the running editor; the user gets a "Load" prompt.
4. When the user presses "→ Claude" in the editor: `node src/cli.js pull` writes `.mapforge/outbox.spec.json`,
   `outbox.sketch.png`, `outbox.msav`, `outbox.png` – read the PNGs to see what they drew.
5. `node src/cli.js image drawing.png --width 200` turns the user's hand drawing into a spec (red strokes = walls,
   outside of the outline = wall, small loops = rocks; `src/core/imagesketch.js`).
6. `node src/cli.js beautify map.msav` regenerates an existing (ugly) map keeping its layout.

## Verifying in the real game
`../Mindustry_map_editor-master/server/build/libs/server-release.jar` (build: `./gradlew server:dist`).
Copy a map to `<tmp>/config/maps/`, pipe `host <Map_Name>` and `save x` into the jar, then compare
`config/saves/x.msav` with the original via `loadMap` – generated maps round-trip with 0 tile differences.
Maps must carry `genfilters: '[]'`, otherwise the game adds its default ores/boulders on load.

## Generator rules worth keeping
- Biome patch layers only paint onto the base floor or their own nested chain (same `noise` key) – patches must not punch holes into each other.
- Liquids *and painted walls* use the gentle warp, so thin rivers/wall lines stay connected and a later stroke wins; painted walls are never eroded by the CA.
- Sketch has a `fixed` mask (spec: `fixed: true` per shape or `fixedRLE`): fixed tiles are taken exactly (no warp, no rocks/CA, path carving avoids fixed walls); relative tiles are hints.
- Image import fills regions by even-odd nesting depth across red lines (outside = rock, inside = land, shape in land = rock).
- CA treats out-of-map neighbours as the tile itself (otherwise walls appear along every map edge).
