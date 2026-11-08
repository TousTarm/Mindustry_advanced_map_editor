// UI translations. Every entry keeps the Czech and English text side by side: { cs, en }.
// HTML uses data-i18n (text), data-i18n-title (tooltip) and data-i18n-ph (placeholder) attributes.
// Language: ?lang=cs|en in the URL, then the last choice, then the browser language.
// To add a language, add its code to LANGS and a matching field to each entry.

export const LANGS = ['cs', 'en'];

const T = {
  // ---------------------------------------------------------------- top bar
  'top.new': { cs: 'Nová', en: 'New' },
  'top.new.tip': { cs: 'Nová mapa', en: 'New map' },
  'top.open': { cs: 'Otevřít', en: 'Open' },
  'top.open.tip': { cs: 'Otevřít .msav mapu nebo projekt .mindscape.json', en: 'Open a .msav map or a .mindscape.json project' },
  'top.image': { cs: 'Obrázek', en: 'Image' },
  'top.image.tip': { cs: 'Načíst vlastní nakreslenou skicu (obrázek) – červené čáry = zdi', en: 'Load your own drawn sketch (image) – red lines = walls' },
  'top.save': { cs: 'Uložit projekt', en: 'Save project' },
  'top.save.tip': { cs: 'Uložit projekt (skica + parametry + zamčené dlaždice)', en: 'Save the project (sketch + parameters + locked tiles)' },
  'top.export': { cs: 'Export .msav', en: 'Export .msav' },
  'top.export.tip': { cs: 'Stáhnout .msav pro Mindustry', en: 'Download a .msav for Mindustry' },
  'top.sketch': { cs: 'Skica', en: 'Sketch' },
  'top.sketch.tip': { cs: 'Skica: hrubý layout (Tab)', en: 'Sketch: rough layout (Tab)' },
  'top.edit': { cs: 'Úpravy', en: 'Edit' },
  'top.edit.tip': { cs: 'Úpravy: dlaždice, zámky (Tab)', en: 'Edit: tiles and locks (Tab)' },
  'top.undo.tip': { cs: 'Zpět (Ctrl+Z)', en: 'Undo (Ctrl+Z)' },
  'top.redo.tip': { cs: 'Znovu (Ctrl+Y)', en: 'Redo (Ctrl+Y)' },
  'top.generate': { cs: 'Generovat', en: 'Generate' },
  'top.generate.tip': { cs: 'Vygenerovat (G)', en: 'Generate (G)' },
  'top.rerollAll': { cs: '🎲 Vše', en: '🎲 All' },
  'top.rerollAll.tip': { cs: 'Nový seed pro všechno (Shift+G)', en: 'New seed for everything (Shift+G)' },
  'top.claude.tip': { cs: 'Pošle aktuální skicu a mapu do .mindscape/outbox pro Clauda', en: 'Send the current sketch and map to .mindscape/outbox for Claude' },
  'top.lang.tip': { cs: 'Jazyk / Language', en: 'Language / Jazyk' },

  // ---------------------------------------------------------------- left panel
  'left.tools': { cs: 'Nástroje', en: 'Tools' },
  'left.brush': { cs: 'Štětec', en: 'Brush' },
  'left.relative': { cs: 'Relativní', en: 'Relative' },
  'left.fixed': { cs: 'Fixní', en: 'Fixed' },
  'left.fixed.tip': { cs: 'Relativní = náznak pro noise, Fixní = přesně tak, jak je nakreslené (X)', en: 'Relative = a hint for the noise, Fixed = exactly as drawn (X)' },
  'left.shape': { cs: 'Tvar', en: 'Shape' },
  'left.circle': { cs: 'kruh', en: 'circle' },
  'left.square': { cs: 'čtverec', en: 'square' },
  'left.symmetry': { cs: 'Symetrie', en: 'Symmetry' },
  'sym.none': { cs: 'žádná', en: 'none' },
  'sym.x': { cs: 'zrcadlo ↔', en: 'mirror ↔' },
  'sym.y': { cs: 'zrcadlo ↕', en: 'mirror ↕' },
  'sym.xy': { cs: '4× zrcadlo', en: '4× mirror' },
  'sym.rot2': { cs: 'rotace 180°', en: 'rotate 180°' },
  'left.palette': { cs: 'Paleta', en: 'Palette' },
  'left.search': { cs: 'Hledat blok…', en: 'Search blocks…' },

  // ---------------------------------------------------------------- right panel
  'right.map': { cs: 'Mapa', en: 'Map' },
  'right.name': { cs: 'Název', en: 'Name' },
  'right.author': { cs: 'Autor', en: 'Author' },
  'right.desc': { cs: 'Popis', en: 'Description' },
  'right.base': { cs: 'Základní biom', en: 'Base biome' },
  'right.resize': { cs: 'Změnit velikost', en: 'Resize' },
  'right.flip': { cs: 'Zrcadlit', en: 'Flip' },
  'right.flipX.tip': { cs: 'Zrcadlit vodorovně', en: 'Flip horizontally' },
  'right.flipY.tip': { cs: 'Zrcadlit svisle', en: 'Flip vertically' },
  'right.size': { cs: '{w} × {h} dlaždic', en: '{w} × {h} tiles' },
  'right.generator': { cs: 'Generátor', en: 'Generator' },
  'right.seed': { cs: 'Seed', en: 'Seed' },
  'reroll.shape': { cs: '🎲 Tvary', en: '🎲 Shapes' },
  'reroll.shape.tip': { cs: 'Nový tvar okrajů', en: 'New edge shapes' },
  'reroll.floor': { cs: '🎲 Podlahy', en: '🎲 Floors' },
  'reroll.floor.tip': { cs: 'Nové skvrny podlah a pláže', en: 'New floor patches and beaches' },
  'reroll.rocks': { cs: '🎲 Skály', en: '🎲 Rocks' },
  'reroll.rocks.tip': { cs: 'Nové skalní útvary', en: 'New rock formations' },
  'reroll.ores': { cs: '🎲 Rudy', en: '🎲 Ores' },
  'reroll.ores.tip': { cs: 'Nové rozmístění rud', en: 'New ore placement' },
  'reroll.deco': { cs: '🎲 Dekorace', en: '🎲 Decoration' },
  'reroll.deco.tip': { cs: 'Nové balvany, stromy, cesty', en: 'New boulders, trees and paths' },
  'right.autoGen': { cs: 'Generovat automaticky po tahu', en: 'Regenerate after each stroke' },
  'right.view': { cs: 'Zobrazení', en: 'View' },
  'right.sketchOpacity': { cs: 'Skica', en: 'Sketch' },
  'right.bgOpacity': { cs: 'Obrázek', en: 'Image' },
  'right.showLocks': { cs: 'Zobrazit zámky', en: 'Show locks' },
  'right.grid': { cs: 'Mřížka', en: 'Grid' },
  'right.lockAll': { cs: 'Zamknout vše', en: 'Lock all' },
  'right.unlockAll': { cs: 'Odemknout vše', en: 'Unlock all' },
  'right.beautify': { cs: '✨ Zkrášlit mapu', en: '✨ Beautify map' },
  'right.beautify.tip': { cs: 'Odvodí skicu z aktuální mapy a vygeneruje ji znovu s přirozenými detaily', en: 'Derive a sketch from the current map and regenerate it with natural detail' },
  'right.shores': { cs: 'Pláže a přechody u:', en: 'Beaches and transitions for:' },

  // ---------------------------------------------------------------- dialogs
  'dlg.width': { cs: 'Šířka', en: 'Width' },
  'dlg.height': { cs: 'Výška', en: 'Height' },
  'dlg.cancel': { cs: 'Zrušit', en: 'Cancel' },
  'dlg.new.title': { cs: 'Nová mapa', en: 'New map' },
  'dlg.new.island': { cs: 'Začít jako ostrov obklopený skálou', en: 'Start as an island surrounded by rock' },
  'dlg.new.ok': { cs: 'Vytvořit', en: 'Create' },
  'dlg.resize.title': { cs: 'Velikost mapy', en: 'Map size' },
  'dlg.resize.h': { cs: 'Vodorovně', en: 'Horizontal' },
  'dlg.resize.v': { cs: 'Svisle', en: 'Vertical' },
  'dlg.resize.center': { cs: 'střed', en: 'center' },
  'dlg.resize.left': { cs: 'ukotvit vlevo', en: 'anchor left' },
  'dlg.resize.right': { cs: 'ukotvit vpravo', en: 'anchor right' },
  'dlg.resize.bottom': { cs: 'ukotvit dole', en: 'anchor bottom' },
  'dlg.resize.top': { cs: 'ukotvit nahoře', en: 'anchor top' },
  'dlg.resize.note': { cs: 'Mapa se ořízne nebo rozšíří. Nové místo pokračuje tím, co je na okraji.', en: 'The map is cropped or extended. New space continues whatever is at the edge.' },
  'dlg.resize.ok': { cs: 'Použít', en: 'Apply' },
  'dlg.image.title': { cs: 'Skica z obrázku', en: 'Sketch from image' },
  'dlg.image.aspect': { cs: 'Zachovat poměr stran', en: 'Keep aspect ratio' },
  'dlg.image.walls': { cs: 'Červené čáry → zdi (vnějšek obrysu = skála)', en: 'Red lines → walls (outside the outline = rock)' },
  'dlg.image.fixed': { cs: 'Zdi z obrázku jako fixní (jinak je noise přetvoří)', en: 'Keep walls from the image fixed (otherwise the noise reshapes them)' },
  'dlg.image.close': { cs: 'Uzavírat mezery', en: 'Close gaps' },
  'dlg.image.line': { cs: 'Tloušťka zdí', en: 'Wall thickness' },
  'dlg.image.replace': { cs: 'Nová mapa (jinak jen pozadí přes aktuální mapu)', en: 'New map (otherwise only a background over the current map)' },
  'dlg.image.ok': { cs: 'Načíst', en: 'Load' },

  // ---------------------------------------------------------------- tools
  'tool.brush': { cs: 'Štětec', en: 'Brush' },
  'tool.erase': { cs: 'Guma', en: 'Eraser' },
  'tool.fill': { cs: 'Výplň', en: 'Fill' },
  'tool.path': { cs: 'Řeka', en: 'River' },
  'tool.line': { cs: 'Čára', en: 'Line' },
  'tool.rect': { cs: 'Obdélník', en: 'Rectangle' },
  'tool.ellipse': { cs: 'Elipsa', en: 'Ellipse' },
  'tool.core': { cs: 'Core', en: 'Core' },
  'tool.spawn': { cs: 'Spawn', en: 'Spawn' },
  'tool.ore': { cs: 'Ruda', en: 'Ore' },
  'tool.pan': { cs: 'Posun', en: 'Pan' },
  'tool.spray': { cs: 'Sprej', en: 'Spray' },
  'tool.picker': { cs: 'Kapátko', en: 'Picker' },
  'tool.lock': { cs: 'Zamknout', en: 'Lock' },
  'tool.unlock': { cs: 'Odemknout', en: 'Unlock' },

  // ---------------------------------------------------------------- palette
  'pal.ore': { cs: 'Ruda', en: 'Ore' },
  'pal.sketch': { cs: 'Paleta skici', en: 'Sketch palette' },
  'pal.blocks': { cs: 'Bloky', en: 'Blocks' },
  'tab.floor': { cs: 'Podlahy', en: 'Floors' },
  'tab.wall': { cs: 'Zdi', en: 'Walls' },
  'tab.overlay': { cs: 'Rudy', en: 'Ores' },
  'tab.prop': { cs: 'Dekorace', en: 'Decoration' },

  // ---------------------------------------------------------------- sketch labels (biomes, liquids)
  'label.wall': { cs: 'Skála', en: 'Rock' },
  'label.void': { cs: 'Prázdno', en: 'Void' },
  'label.sand': { cs: 'Písek', en: 'Sand' },
  'label.darksand': { cs: 'Tmavý písek', en: 'Dark sand' },
  'label.stone': { cs: 'Kámen', en: 'Stone' },
  'label.grass': { cs: 'Tráva', en: 'Grass' },
  'label.snow': { cs: 'Sníh', en: 'Snow' },
  'label.ice': { cs: 'Led', en: 'Ice' },
  'label.moss': { cs: 'Mech', en: 'Moss' },
  'label.spore': { cs: 'Spóry', en: 'Spore moss' },
  'label.shale': { cs: 'Břidlice', en: 'Shale' },
  'label.basalt': { cs: 'Čedič', en: 'Basalt' },
  'label.salt': { cs: 'Sůl', en: 'Salt' },
  'label.dirt': { cs: 'Hlína', en: 'Dirt' },
  'label.water': { cs: 'Voda', en: 'Water' },
  'label.tainted': { cs: 'Kontam. voda', en: 'Tainted water' },
  'label.slag': { cs: 'Struska', en: 'Slag' },
  'label.tar': { cs: 'Dehet', en: 'Tar' },
  'label.cryo': { cs: 'Kryo', en: 'Cryofluid' },

  // ---------------------------------------------------------------- generator parameters: name + tooltip
  'param.warp': { cs: 'Zvlnění tvarů', en: 'Shape warp' },
  'param.warp.tip': { cs: 'Jak moc se velké tvary ze skici kroutí', en: 'How much the large sketch shapes twist' },
  'param.rough': { cs: 'Roztřepení okrajů', en: 'Edge roughness' },
  'param.rough.tip': { cs: 'Drobná nepravidelnost hran', en: 'Small irregularities along edges' },
  'param.liquidWarp': { cs: 'Zvlnění vody', en: 'Liquid warp' },
  'param.liquidWarp.tip': { cs: 'Řeky drží skicu víc než pevnina (0 = přesně podle skici)', en: 'Rivers follow the sketch more closely than land (0 = exactly as sketched)' },
  'param.dither': { cs: 'Prolínání biomů', en: 'Biome blending' },
  'param.dither.tip': { cs: 'Tečkovaný přechod mezi biomy', en: 'Dithered transition between biomes' },
  'param.detail': { cs: 'Detail podlah', en: 'Floor detail' },
  'param.detail.tip': { cs: 'Množství skvrn sekundárních podlah', en: 'Amount of secondary floor patches' },
  'param.shore': { cs: 'Šířka pláží', en: 'Beach width' },
  'param.shore.tip': { cs: 'Pásy písku a mělčin u vody', en: 'Bands of sand and shallows along liquids' },
  'param.rocks': { cs: 'Skály', en: 'Rocks' },
  'param.rocks.tip': { cs: 'Hustota skalních útvarů uvnitř pevniny', en: 'Density of rock formations on land' },
  'param.rockScale': { cs: 'Velikost skal', en: 'Rock size' },
  'param.rockScale.tip': { cs: 'Velikost skalních útvarů', en: 'Size of rock formations' },
  'param.smooth': { cs: 'Vyhlazení skal', en: 'Rock smoothing' },
  'param.smooth.tip': { cs: 'Průchody cellular automata', en: 'Cellular automata passes' },
  'param.border': { cs: 'Okraj mapy', en: 'Map border' },
  'param.border.tip': { cs: 'Tloušťka skály na okraji mapy', en: 'Rock thickness along the map edge' },
  'param.boulders': { cs: 'Balvany', en: 'Boulders' },
  'param.boulders.tip': { cs: 'Hustota balvanů (víc u skal)', en: 'Boulder density (more near rocks)' },
  'param.trees': { cs: 'Stromy', en: 'Trees' },
  'param.trees.tip': { cs: 'Stromy v trávě a sněhu', en: 'Trees in grass and snow' },
  'param.ores': { cs: 'Rudy', en: 'Ores' },
  'param.ores.tip': { cs: 'Množství rud (vzácnější dál od core)', en: 'Ore amount (rarer ores further from the core)' },
  'param.coreClear': { cs: 'Volno u core', en: 'Core clearance' },
  'param.coreClear.tip': { cs: 'Poloměr volného místa kolem core', en: 'Radius of free space around the core' },
  'param.deep': { cs: 'Hloubka vody', en: 'Water depth' },
  'param.deep.tip': { cs: '0 = jen mělká voda, víc = hluboká voda dřív od břehu', en: '0 = shallow water only, higher = deep water closer to shore' },
  'param.oresOn': { cs: 'Rudy', en: 'Ores' },
  'param.startOres': { cs: 'Měď a olovo u core', en: 'Copper and lead near the core' },
  'param.ensurePath': { cs: 'Zaručit cestu spawn → core', en: 'Guarantee a spawn → core path' },

  // ---------------------------------------------------------------- tool hints
  'hint.brush.sketch': { cs: 'Maluj hrubé oblasti. <b>Relativní</b> tvary jsou jen náznak a noise je přetvoří. <b>Fixní</b> zůstanou přesně tak, jak jsou nakreslené (přepínač <kbd>X</kbd>, fixní mají bílý obrys).', en: 'Paint rough areas. <b>Relative</b> shapes are only a hint and the noise reshapes them. <b>Fixed</b> shapes stay exactly as drawn (toggle with <kbd>X</kbd>; fixed shapes have a white outline).' },
  'hint.brush.edit': { cs: 'Kresli vybraný blok. Upravené dlaždice se samy zamknou, takže je další generování nepřepíše.', en: 'Paint the selected block. Edited tiles are locked automatically, so regenerating won\'t overwrite them.' },
  'hint.erase.sketch': { cs: 'Vrátí oblast na základní biom.', en: 'Resets the area to the base biome.' },
  'hint.erase.edit': { cs: 'Smaže zdi, dekorace a rudy.', en: 'Removes walls, decoration and ores.' },
  'hint.fill.sketch': { cs: 'Vyplní souvislou oblast.', en: 'Fills a connected area.' },
  'hint.fill.edit': { cs: 'Vyplní souvislou oblast. <kbd>Shift</kbd>+klik nahradí všechny stejné dlaždice v celé mapě.', en: 'Fills a connected area. <kbd>Shift</kbd>+click replaces every matching tile on the map.' },
  'hint.line': { cs: 'Táhni myší pro rovnou čáru (šířka = štětec).', en: 'Drag to draw a straight line (width = brush size).' },
  'hint.spray': { cs: 'Náhodně rozprašuje vybraný blok, hodí se na balvany a rudy.', en: 'Scatters the selected block randomly – good for boulders and ores.' },
  'hint.path': { cs: 'Klikáním přidávej body řeky, dvojklik nebo <kbd>Enter</kbd> ji dokončí, <kbd>Esc</kbd> zruší. Šířku určuje štětec.', en: 'Click to add river points; double-click or <kbd>Enter</kbd> finishes, <kbd>Esc</kbd> cancels. Width = brush size.' },
  'hint.drag': { cs: 'Táhni myší.', en: 'Drag with the mouse.' },
  'hint.core': { cs: 'Klik = tvoje core, <kbd>Shift</kbd>+klik = nepřátelské core, <kbd>Alt</kbd>+klik = smazat. Se symetrií vzniknou PvP core.', en: 'Click = your core, <kbd>Shift</kbd>+click = enemy core, <kbd>Alt</kbd>+click = delete. With symmetry on, PvP cores are created.' },
  'hint.spawn': { cs: 'Klik = spawn nepřátel, <kbd>Alt</kbd>+klik = smazat.', en: 'Click = enemy spawn, <kbd>Alt</kbd>+click = delete.' },
  'hint.ore': { cs: 'Klik = ložisko vybrané rudy (velikost = štětec), <kbd>Alt</kbd>+klik = smazat.', en: 'Click = deposit of the selected ore (size = brush), <kbd>Alt</kbd>+click = delete.' },
  'hint.picker': { cs: 'Klikni na dlaždici a vezmi její blok.', en: 'Click a tile to pick its block.' },
  'hint.lock': { cs: 'Zamčené dlaždice zůstanou při dalším generování beze změny.', en: 'Locked tiles stay unchanged when regenerating.' },
  'hint.unlock': { cs: 'Odemčené dlaždice se při dalším generování přepíšou.', en: 'Unlocked tiles are overwritten when regenerating.' },
  'hint.pan': { cs: 'Táhni pro posun. Kdykoli funguje i prostřední nebo pravé tlačítko a <kbd>Space</kbd>.', en: 'Drag to pan. The middle or right mouse button and <kbd>Space</kbd> work at any time.' },
  'hint.keys': { cs: '<kbd>Tab</kbd> skica/úpravy · <kbd>G</kbd> generovat · <kbd>Shift+G</kbd> nový seed · <kbd>[</kbd> <kbd>]</kbd> štětec · <kbd>H</kbd> skica přes mapu · kolečko = zoom', en: '<kbd>Tab</kbd> sketch/edit · <kbd>G</kbd> generate · <kbd>Shift+G</kbd> new seed · <kbd>[</kbd> <kbd>]</kbd> brush · <kbd>H</kbd> sketch overlay · wheel = zoom' },

  // ---------------------------------------------------------------- messages
  'msg.generating': { cs: 'Generuji…', en: 'Generating…' },
  'msg.generated': { cs: 'Vygenerováno za {ms} ms · seed {seed}', en: 'Generated in {ms} ms · seed {seed}' },
  'msg.genError': { cs: 'Chyba generování', en: 'Generation error' },
  'msg.genFailed': { cs: 'Generování selhalo: {err}', en: 'Generation failed: {err}' },
  'msg.newMap': { cs: 'Nová mapa', en: 'New map' },
  'msg.loadedMsav': { cs: 'Načteno: {w}×{h}. Skica byla odvozena z mapy – <b>✨ Zkrášlit</b> ji přegeneruje s detaily.', en: 'Loaded: {w}×{h}. The sketch was derived from the map – <b>✨ Beautify</b> regenerates it with detail.' },
  'msg.claudeSent': { cs: '🤖 Claude poslal návrh{note}', en: '🤖 Claude sent a design{note}' },
  'msg.load': { cs: 'Načíst', en: 'Load' },
  'msg.ignore': { cs: 'Ignorovat', en: 'Ignore' },
  'msg.sentToClaude': { cs: 'Odesláno do .mindscape/outbox – napiš Claudovi, ať se podívá.', en: 'Sent to .mindscape/outbox – ask Claude to take a look.' },
  'msg.noBridge': { cs: 'Bridge není dostupný (spusť editor přes npm run dev): {err}', en: 'Bridge not available (run the editor with npm run dev): {err}' },
  'msg.generateFirst': { cs: 'Nejdřív vygeneruj mapu.', en: 'Generate a map first.' },
  'msg.cantLoad': { cs: 'Soubor nejde načíst: {err}', en: 'Can\'t load the file: {err}' },
  'msg.fixedOn': { cs: 'Fixní tvary – zůstanou přesně tak, jak jsou nakreslené', en: 'Fixed shapes – kept exactly as drawn' },
  'msg.fixedOff': { cs: 'Relativní tvary – náznak pro noise', en: 'Relative shapes – a hint for the noise' },
  'msg.imageLoaded': { cs: 'Skica načtena. Core a spawny si polož nástroji v režimu Skica, průhlednost obrázku je v panelu Zobrazení.', en: 'Sketch loaded. Place the core and spawns with the Sketch tools; the image opacity is in the View panel.' },
  'msg.restored': { cs: 'Obnoven poslední projekt', en: 'Last project restored' },
};

const detect = () => {
  const q = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(q)) return q;
  try { const s = localStorage.getItem('mindscape-lang'); if (LANGS.includes(s)) return s; } catch { /* storage blocked */ }
  return (navigator.language || '').toLowerCase().startsWith('cs') ? 'cs' : 'en';
};
let lang = detect();

export const getLang = () => lang;

/** Translate a key; {name} placeholders are filled from vars. Falls back to English, then to the key. */
export function t(key, vars) {
  const e = T[key];
  let s = e ? e[lang] ?? e.en : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

/** Apply translations to every element with data-i18n / data-i18n-title / data-i18n-ph. */
export function applyDom(root = document) {
  document.documentElement.lang = lang;
  for (const el of root.querySelectorAll('[data-i18n]')) el.innerHTML = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
}

export function setLang(l) {
  if (!LANGS.includes(l)) return;
  lang = l;
  try { localStorage.setItem('mindscape-lang', l); } catch { /* storage blocked */ }
  applyDom();
}
