<div align="center">

# MapForge

**A map editor for [Mindustry](https://github.com/Anuken/Mindustry) that turns a rough sketch into natural-looking terrain.**

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![Mindustry](https://img.shields.io/badge/Mindustry-Serpulo-ffd37f)

![Sketch → generated map](docs/preview.jpg)

</div>

## About

Making a good-looking map in Mindustry's built-in editor takes a lot of work. Hand-made maps often end up
looking like they were built from rectangles, with hard transitions, straight shorelines and flat floors.

MapForge works the other way round. You draw the **layout**: where the land, rivers, lakes, rocks, core
and spawns go. The generator fills in the kind of **detail** you see on the campaign maps:
- organic, wavy edges;
- deep and shallow water with beaches;
- smooth blending between biomes;
- rock formations, boulders and ore deposits.

If you don't like the result, reroll it. If you do, polish it by hand.

### Goals

- **Maps that don't look artificial.** Noise, domain warping and distance fields instead of straight lines.
- **Fast iteration.** Sketch, generate, reroll single layers and edit by hand without ever restarting the game.
- **Game compatibility.** Exports a `.msav` that opens directly in Mindustry.
- **Scriptable.** A CLI and an API that let you, or an AI assistant, design maps from code.

## Features

- 🖌️ **Sketch mode**: brush, rectangle, ellipse, rivers, fill, and symmetry for PvP maps.
- 📐 **Relative and fixed shapes**:
  - a relative shape is a hint that the noise reshapes;
  - a fixed shape stays exactly as drawn.
- 🌊 **Generator**: 12 biomes and liquids (water, tainted water, slag, tar, cryofluid) with adjustable depth and beaches. It also places rocks, ores and decoration.
- 🎲 **Per-layer reroll**: shapes, floors, rocks, ores or decoration on their own. `Ctrl+Z` undoes a reroll too.
- 🔒 **Locks**: tiles you edit by hand are locked, so regenerating never overwrites them.
- 🖼️ **Sketch from an image**: draw your map in any paint program. Red lines become walls, and inside and outside are detected automatically.
- ✨ **Beautify existing maps**: load a `.msav`, derive a sketch from it and regenerate it with natural detail.
- 📏 Resize, flip, grid overlay, and the project autosaves in the browser.
- 💾 `.msav` import and export (save version 11) and project files (`.mfp.json`).
- 🤖 **CLI and editor bridge** for scripting and for working with an AI assistant.

## Getting started

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
git clone https://github.com/TousTarm/Mindustry_advanced_map_editor.git
cd Mindustry_advanced_map_editor
npm install
npm run dev
```

The editor runs at **http://localhost:5178**.

To build the static files into `dist/`:

```bash
npm run build
npm run preview
```

## How it works

1. **Sketch** (`Tab` switches modes). Paint rough areas and place the core, spawns and any ore deposits.
   - Areas can be biomes, rock, water or slag.
   - Draw rivers with the *River* tool: click to add points and double-click to finish.
   - The map regenerates after every stroke.
2. **Generator** (right panel). Use the sliders for edge warp, biome blending, beach width, water depth,
   and how many rocks and ores to place. The 🎲 buttons reroll a single layer.
3. **Edit**. Paint specific blocks by hand: floors, walls, ores and decoration. Edited tiles get locked.
4. **Export .msav** downloads the map. In the game, open the map editor and use *Import Map*, or copy the
   file into your `maps/` folder.

**Image as a sketch:**
- Load a picture where the walls are drawn in red.
- Small gaps in the lines are closed, and every other colour is ignored.
- Regions are filled by how deeply they are nested: the outside is rock, the inside is land, and a shape drawn inside the land is rock again.
- The image stays visible as a semi-transparent background.

### Keyboard shortcuts

| Key | Action | Key | Action |
|---|---|---|---|
| `B` | brush | `G` | generate |
| `E` | eraser | `Shift+G` | new seed |
| `F` | fill (`Shift` = whole map) | `X` | relative / fixed |
| `L` | river | `[` `]` | brush size |
| `R` / `O` | rectangle / ellipse | `H` | sketch overlay |
| `C` / `S` | core / spawn | `0` | center view |
| `Ctrl+Z` / `Ctrl+Y` | undo / redo | Space, right mouse | pan |

## CLI

```bash
node src/cli.js gen examples/river-valley.json --scale 4   # spec → .msav + .png preview
node src/cli.js sketch examples/river-valley.json          # preview only the layout
node src/cli.js beautify map.msav                          # beautify an existing map
node src/cli.js image drawing.png --width 200              # red-line drawing → spec
node src/cli.js render map.msav --scale 4                  # render any map
node src/cli.js info map.msav                              # size, tags, block histogram
node src/cli.js help                                       # all commands and options
```

A map is described by a **JSON spec**: its size, a base biome, a list of shapes (`fill`, `rect`, `circle`,
`ellipse`, `polygon`, `path`), the core, the spawns and any ore deposits. There are more examples in
[`examples/`](examples/), and `node src/cli.js labels` lists all labels and parameters.

```json
{
  "name": "My Map", "width": 200, "height": 200, "base": "stone", "seed": 7,
  "shapes": [
    { "type": "fill", "label": "wall" },
    { "type": "circle", "label": "stone", "center": [100, 100], "r": 90 },
    { "type": "path", "label": "water", "points": [[0, 120], [90, 90], [200, 60]], "width": [6, 12] },
    { "type": "rect", "label": "wall", "rect": [120, 130, 20, 10], "fixed": true }
  ],
  "core": [40, 60],
  "spawns": [[160, 160]],
  "ores": [{ "ore": "ore-titanium", "center": [150, 40], "r": 6 }]
}
```

Coordinates are in tiles, with y pointing up and (0, 0) at the bottom-left, the same as in Mindustry.
Generation is deterministic: the same spec with the same seed always produces the same map.

## Project structure

```
src/core/      generator, .msav reader/writer, renderer, sketch (runs in Node and the browser)
src/node/      file I/O for the CLI
src/cli.js     command-line interface
web/           the editor (Vite; generation runs in a Web Worker)
data/          block catalog and building templates extracted from Mindustry
public/        sprite atlas
scripts/       rebuild data/ and the atlas from Mindustry sources (npm run catalog)
examples/      example specs
```

## Roadmap

- [ ] Erekir planet
- [ ] Wave and map rules editor
- [ ] Placing buildings and teams
- [ ] More biomes and palettes

## License

MapForge is released under the [MIT License](LICENSE). © 2026 TousTarm.

You're free to use, modify and share it, including in commercial projects. If you build on it or fork it,
please keep the license notice and **credit TousTarm as the original author**.

The sprites in `public/atlas.png` and the data in `data/` come from [Mindustry](https://github.com/Anuken/Mindustry)
by Anuke and are covered by its license (GPL-3.0). MapForge is not affiliated with the official game.
