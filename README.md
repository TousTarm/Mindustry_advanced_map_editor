# MapForge

Editor map pro Mindustry (Serpulo), který z hrubé skici vygeneruje přirozeně vypadající terén:
hluboká a mělká voda, pláže, plynulé přechody biomů, skály, balvany, rudy. Výsledek se exportuje
jako `.msav`, který jde rovnou otevřít ve hře.

## Spuštění

```bash
npm install
npm run dev          # editor na http://localhost:5178
```

## Jak se s tím pracuje

1. **Skica** (`Tab` přepíná režimy): namaluj hrubé oblasti, tedy biomy, skálu, vodu, slag, řeky (nástroj
   *Řeka*: klikáním body, dvojklik dokončí). Polož core, spawny a případně ložiska rud. Po každém tahu
   se mapa přegeneruje.
2. **Generátor** (pravý panel): posuvníky pro zvlnění tvarů, roztřepení okrajů, prolínání biomů,
   množství skvrn, šířku pláží, skály, rudy a další.
   - `🎲` u jednotlivých vrstev přegeneruje jen tu vrstvu, třeba jen rudy nebo jen skály.
   - `Ctrl+Z` vrátí i reroll, takže se vždycky dostaneš k předchozí verzi, která se ti líbila.
3. **Úpravy**: ruční kreslení konkrétních bloků (podlahy, zdi, rudy, dekorace). Upravené dlaždice
   se samy **zamknou**, takže je další generování nepřepíše. Zamykat se dají i celé oblasti, které
   se povedly, a zbytek se pak dál rerolluje.
4. **Export .msav** stáhne mapu pro hru. **Uložit projekt** uloží skicu, parametry i zámky.
   Projekt se navíc průběžně ukládá do prohlížeče.

**Relativní a fixní tvary** (přepínač v levém panelu, klávesa `X`):
- Relativní tvar je jen náznak. Noise ho přetvoří a při rerollu se může změnit.
- Fixní tvar zůstane přesně tak, jak je nakreslený: žádné vlnění, žádné náhodné skály, nikdy se nesmaže.
  Ve skice má bílý obrys.

Další možnosti:
- **Obrázek**: načte vlastní nakreslenou skicu (třeba z malování). Zobrazí se jako průhledné pozadí
  a **červené čáry se převedou na zdi**. Vnějšek obrysu bude skála, malé mezery v čarách se uzavřou
  Oblasti se vyplňují podle vnoření: vnějšek je skála, uvnitř pevnina, tvar nakreslený uvnitř pevniny je
  znovu skála. Malé smyčky jsou skály. Ostatní barvy se ignorují.
- **Změnit velikost**: šířka a výška s ukotvením. Nový prostor pokračuje tím, co je na okraji.
  K tomu zrcadlení mapy.
- Úpravy: štětec (kruh nebo čtverec), čára, sprej, výplň (`Shift` = nahradit v celé mapě), kapátko.
- **Symetrie** (zrcadlení nebo rotace) pro PvP mapy. Se symetrií vznikne protilehlé core jako nepřátelské.
- **Otevřít .msav** načte existující mapu a odvodí z ní skicu. **✨ Zkrášlit mapu** ji přegeneruje
  se stejným layoutem, ale s přirozenými detaily.
- **→ Claude** pošle aktuální skicu a mapu Claudovi (`.mapforge/outbox`). Claude zase může
  poslat návrh do editoru a ten nabídne jeho načtení.

Zkratky: `B` štětec, `E` guma, `F` výplň, `L` řeka, `R`/`O` obdélník/elipsa, `C` core, `S` spawn,
`G` generovat, `Shift+G` nový seed, `[` `]` velikost štětce, `H` skica přes mapu, `0` vycentrovat,
mezerník / pravé tlačítko = posun, kolečko = zoom.

## CLI

```bash
node src/cli.js gen examples/river-valley.json      # spec → .msav + .png
node src/cli.js beautify mapa.msav                  # zkrášlí existující mapu
node src/cli.js image skica.png --width 200         # obrázek s červenými čarami → spec
node src/cli.js render mapa.msav --scale 4          # náhled libovolné mapy
node src/cli.js help
```
