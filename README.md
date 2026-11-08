<div align="center">

# MapForge

**Editor map pro [Mindustry](https://github.com/Anuken/Mindustry), který z hrubé skici vygeneruje přirozeně vypadající terén.**

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![Mindustry](https://img.shields.io/badge/Mindustry-Serpulo-ffd37f)

![Skica → vygenerovaná mapa](docs/preview.jpg)

</div>

## O projektu

Kreslit hezkou mapu ve vestavěném editoru Mindustry je pracné. Mapy pak často vypadají jako
poskládané z obdélníků: tvrdé přechody, rovné břehy, jednotvárná podlaha.

MapForge to dělá opačně. Ty určíš **layout**, tedy kde je pevnina, řeka, jezero, skály, core
a spawny. Generátor kolem toho dopočítá **detaily**, jaké mají kampaňové mapy:
- vlnité okraje,
- hlubokou a mělkou vodu s plážemi,
- plynulé přechody biomů,
- skalní útvary, balvany a ložiska rud.

Když se výsledek nelíbí, stačí reroll. Když se líbí, doladíš ho ručně.

### Cíle

- **Mapy, které nevypadají uměle**: noise, domain warping a distance fields místo pravítka.
- **Rychlá iterace**: skica → generování → reroll jednotlivých vrstev → ruční úpravy, bez restartu hry.
- **Kompatibilita se hrou**: export do `.msav`, který jde rovnou otevřít v Mindustry.
- **Skriptovatelnost**: CLI a API, přes které může mapy navrhovat i AI asistent.

## Funkce

- 🖌️ **Skica**: štětec, obdélník, elipsa, řeky, výplň, symetrie pro PvP mapy.
- 📐 **Relativní a fixní tvary**:
  - relativní tvar je náznak, který noise přetvoří;
  - fixní tvar zůstane přesně tak, jak je nakreslený.
- 🌊 **Generátor**: 12 biomů a kapaliny (voda, kontaminovaná voda, slag, dehet, kryo), u kterých jde nastavit hloubka a pláže. K tomu skály, rudy a dekorace.
- 🎲 **Reroll po vrstvách**: tvary, podlahy, skály, rudy, nebo dekorace zvlášť. `Ctrl+Z` vrátí i reroll.
- 🔒 **Zámky**: ručně upravené dlaždice se zamknou a další generování je nepřepíše.
- 🖼️ **Skica z obrázku**: nakresli mapu v malování, červené čáry se převedou na zdi a vnitřek a vnějšek se rozpozná automaticky.
- ✨ **Zkrášlení existující mapy**: načte `.msav`, odvodí z něj skicu a vygeneruje ji znovu s přirozenými detaily.
- 📏 Změna velikosti, zrcadlení, mřížka, průběžné ukládání projektu v prohlížeči.
- 💾 Import a export `.msav` (save verze 11) a ukládání projektu (`.mfp.json`).
- 🤖 **CLI a bridge** pro skriptování a spolupráci s AI asistentem.

## Spuštění

Potřebuješ [Node.js](https://nodejs.org/) 18 nebo novější.

```bash
git clone https://github.com/TousTarm/Mindustry_advanced_map_editor.git
cd Mindustry_advanced_map_editor
npm install
npm run dev
```

Editor poběží na **http://localhost:5178**.

Produkční build (statické soubory do `dist/`):

```bash
npm run build
npm run preview
```

## Jak se s tím pracuje

1. **Skica** (`Tab` přepíná režimy): namaluj hrubé oblasti a polož core, spawny a případně ložiska rud.
   - Oblasti jsou biomy, skála, voda a slag.
   - Řeky kreslí nástroj *Řeka*: klikáním přidáváš body, dvojklik ji dokončí.
   - Po každém tahu se mapa přegeneruje.
2. **Generátor** (pravý panel): posuvníky pro zvlnění tvarů, prolínání biomů, šířku pláží, hloubku vody,
   množství skal a rud. Tlačítka 🎲 přegenerují jen vybranou vrstvu.
3. **Úpravy**: ruční kreslení konkrétních bloků (podlahy, zdi, rudy, dekorace). Upravené dlaždice se zamknou.
4. **Export .msav** stáhne mapu. Ve hře ji najdeš v editoru map přes *Importovat mapu*, nebo ji zkopíruj do složky `maps/`.

**Obrázek jako skica**:
- Načti obrázek, na kterém jsou zdi nakreslené červeně.
- Malé mezery v čarách se uzavřou a ostatní barvy se ignorují.
- Oblasti se vyplní podle vnoření: vnějšek je skála, uvnitř je pevnina a tvar uvnitř pevniny je zase skála.
- Obrázek zůstane jako poloprůhledné pozadí.

### Klávesové zkratky

| Klávesa | Akce | Klávesa | Akce |
|---|---|---|---|
| `B` | štětec | `G` | generovat |
| `E` | guma | `Shift+G` | nový seed |
| `F` | výplň (`Shift` = v celé mapě) | `X` | relativní / fixní |
| `L` | řeka | `[` `]` | velikost štětce |
| `R` / `O` | obdélník / elipsa | `H` | skica přes mapu |
| `C` / `S` | core / spawn | `0` | vycentrovat |
| `Ctrl+Z` / `Ctrl+Y` | zpět / znovu | mezerník, pravé tl. | posun |

## CLI

```bash
node src/cli.js gen examples/river-valley.json --scale 4   # spec → .msav + náhled .png
node src/cli.js sketch examples/river-valley.json          # jen náhled layoutu
node src/cli.js beautify mapa.msav                         # zkrášlí existující mapu
node src/cli.js image skica.png --width 200                # obrázek s červenými čarami → spec
node src/cli.js render mapa.msav --scale 4                 # náhled libovolné mapy
node src/cli.js info mapa.msav                             # velikost, tagy, histogram bloků
node src/cli.js help                                       # všechny příkazy a parametry
```

Mapa se popisuje jako **spec v JSON**: rozměry, základní biom a seznam tvarů (`fill`, `rect`, `circle`,
`ellipse`, `polygon`, `path`), core, spawny a ložiska. Vzory jsou v [`examples/`](examples/), přehled
štítků a parametrů vypíše `node src/cli.js labels`.

```json
{
  "name": "Moje mapa", "width": 200, "height": 200, "base": "stone", "seed": 7,
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

Generátor je deterministický: stejný spec a stejný seed dají vždy stejnou mapu.

## Struktura projektu

```
src/core/      generátor, čtení a zápis .msav, renderer, skica (běží v Node i v prohlížeči)
src/node/      souborové I/O pro CLI
src/cli.js     příkazová řádka
web/           editor (Vite, generování běží ve Web Workeru)
data/          katalog bloků a šablony budov vytažené z Mindustry
public/        texturový atlas
scripts/       přegenerování data/ a atlasu ze zdrojáků Mindustry (npm run catalog)
examples/      ukázkové specy
```

## Plány

- [ ] Planeta Erekir
- [ ] Editor vln nepřátel a pravidel mapy
- [ ] Pokládání budov a týmů
- [ ] Další biomy a palety

## Licence

Kód je pod licencí [MIT](LICENSE). Copyright © 2026 TousTarm.

Textury v `public/atlas.png` a data v `data/` pocházejí ze hry
[Mindustry](https://github.com/Anuken/Mindustry) od Anuke a řídí se její licencí (GPL-3.0).
MapForge není oficiální součást Mindustry.
