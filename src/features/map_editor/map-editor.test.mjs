import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bootConsole, LEGACY_CONSOLE_DIR } from '../../../test/support/fake-game.mjs';

const consoleModule = (relative) => import(pathToFileURL(path.join(LEGACY_CONSOLE_DIR, relative)).href);
const errorsOf = (out) => out.filter((line) => line.startsWith('error: '));
const textsOf = (node) => [node.text, ...(node.childNodes || []).flatMap((n) => (typeof n === 'string' ? [n] : textsOf(n)))].filter(Boolean);

let game;
before(async () => { game = await bootConsole({ sayTrigger: '#chat_in' }); });

test('editor: on and off by its key, outlines every object, selects by click and from its lists', async () => {
  const session = await consoleModule('editor/session.js');
  const { drawEditorFrame } = await consoleModule('editor/view.js');
  const { worldOfEvent } = await consoleModule('editor/input.js');
  const original = game.G[game.N.mapText];
  const overlay = game.G[game.N.uiOverlay].overlay;
  try {
    assert.match(game.run('editor')[0], /^Editor on: click an object to select it\. f8 or "editor" turns it off\./);
    assert.ok(session.editorOn());
    const first = drawEditorFrame();
    assert.ok(first.outlines > 5, JSON.stringify(first));
    assert.ok(textsOf(overlay).includes('Layers:') && textsOf(overlay).includes('Tools:'));
    // The map editor's own icons, from the site.
    const imgs = (node) => [node.src, ...(node.childNodes || []).flatMap((n) => (typeof n === 'string' ? [] : imgs(n)))].filter(Boolean);
    assert.ok(imgs(overlay).includes('/level_editor/icons16/edit.gif') && imgs(overlay).includes('/level_editor/icons16/box.gif'));
    // The map editor's thin scroll bars, from a stylesheet (inline styles cannot do it).
    const sheet = game.G.document.getElementById('pb2dev-editor-style');
    assert.match(sheet.text, /pb2dev-editor-scroll::-webkit-scrollbar \{ width: 1\.75px;/);
    assert.match(sheet.text, /-webkit-scrollbar-thumb \{ border-radius: 1\.75px; background-color: #515151;/);
    const scrollers = (n) => [n.className, ...(n.childNodes || []).flatMap((k) => (typeof k === 'string' ? [] : scrollers(k)))].filter(Boolean);
    assert.ok(scrollers(overlay).filter((cn) => cn === 'pb2dev-editor-scroll').length >= 3, 'both panels and the object box');
    // The game's CSS hides its overlay container; everything put in it must show itself.
    for (const n of overlay.childNodes) if (n.style) assert.equal(n.style.visibility, 'visible', `hidden: ${textsOf(n).slice(0, 2).join(' ')}`);
    assert.match(game.press('F8')[0], /^\[key f8\] > editor/);
    assert.ok(!session.editorOn(), 'the key turns it off');
    assert.equal(drawEditorFrame(), null);
    assert.ok(!textsOf(overlay).includes('Layers:'), 'panels gone');
    assert.equal(game.G.document.getElementById('pb2dev-editor-style'), null, 'and the stylesheet');
    game.press('F8');
    assert.ok(session.editorOn(), 'and on again');

    // A new map text (a restart, another map) is read again.
    game.G[game.N.mapText] = [
      '<box x="0" y="0" w="400" h="200" m="0" />',
      '<box x="100" y="50" w="20" h="20" m="0" />',
      '<trigger uid="#t" x="500" y="0" enabled="true" maxcalls="-1" actions_1_type="100" actions_1_targetA="a" actions_1_targetB="1" />',
      '<timer uid="#clock" x="560" y="0" enabled="true" maxcalls="-1" target="#t" delay="30" />',
    ].join('\n');
    const level = (on) => { game.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
    level(false);
    assert.ok(session.editorOn() && !session.editorShown(), 'hidden while no level runs');
    assert.equal(drawEditorFrame(), null);
    level(true);
    assert.ok(session.editorShown(), 'back with the level');
    const doc = session.editorDoc();
    assert.equal(doc.elements.length, 4);
    assert.equal(doc.toText(), game.G[game.N.mapText], 'the map text comes back as it was');

    // The smallest under the click first; the same spot again takes the next one.
    const at = { x: 110, y: 60 };
    assert.equal(doc.ordinal(session.pickAt(at)), 1);
    assert.equal(doc.ordinal(session.pickAt(at)), 0);
    assert.equal(doc.ordinal(session.pickAt(at)), 1, 'and round again');
    assert.equal(session.pickAt({ x: 1000, y: 1000 }), null, 'nothing there: deselect');
    // Screen to world and back: the fake canvas is 800x400 on screen, as wide as the game.
    const { currentTransform, toScreen } = await consoleModule('../../../src/console/kernel/ui/overlay.ts');
    const back = toScreen(currentTransform(), worldOfEvent({ clientX: 110, clientY: 60 }));
    assert.ok(Math.abs(back.x - 110) < 1e-9 && Math.abs(back.y - 60) < 1e-9, JSON.stringify(back));

    // The selection's logic links, and its params and layer in the panels.
    session.pickAt({ x: 500, y: 0 });
    assert.equal(session.selected().attrs.uid, '#t');
    assert.equal(drawEditorFrame().links, 1, 'the timer that runs it');
    assert.equal(session.currentLayer(), 'trigger');
    const texts = textsOf(overlay);
    assert.ok(texts.includes('Objects (4):') && texts.includes('#t') && texts.includes('1. SetVar') && texts.includes('A (string)'), 'the trigger\'s actions');
    assert.ok(texts.includes('1 trigger selected: #t'));

    // Esc clears the selection; a hidden layer is neither drawn nor picked.
    assert.deepEqual(game.press('Escape'), []);
    assert.equal(session.selected(), null);
    // Layers, as the map editor's: what is not on an active layer is drawn faint and
    // cannot be selected.
    session.setSelectable(session.LAYER_GROUPS.logics);
    assert.equal(drawEditorFrame().outlines, 4, 'still drawn');
    assert.equal(session.pickAt(at), null, 'walls are statics');
    assert.ok(textsOf(overlay).includes('Objects (2):'), 'the object box lists the active layers');
    session.pickAt({ x: 500, y: 0 });
    assert.equal(session.selected().attrs.uid, '#t');
    session.setSelectable(['box']);
    assert.equal(session.selected(), null, 'a selection off the active layers is let go');
    assert.equal(doc.ordinal(session.pickAt(at)), 1);
    const { KIND_TAGS } = await consoleModule('editor/kinds.js');
    // The same from the console: a group, kinds, or + and - (the editor's Ctrl and Alt).
    assert.match(game.run('editor layers entities')[0], /^Layers: player, enemy, vehicle, decoration, gun, barrel, engine mark/);
    game.run('editor layers wall');
    assert.deepEqual(session.selectableLayers(), ['box']);
    game.run('editor layers +trigger');
    game.run('editor layers -wall');
    assert.deepEqual(session.selectableLayers(), ['trigger']);
    assert.match(errorsOf(game.run('editor layers nonsense'))[0], /usage: editor layers/);
    game.run('editor layers all');
    assert.equal(session.selectableLayers().length, KIND_TAGS.length);

    // Off works without a level; on needs one.
    level(false);
    game.run('editor off');
    assert.ok(!session.editorOn());
    assert.match(errorsOf(game.run('editor'))[0], /start a level first/);
  } finally {
    game.G.stage.currentFrameLabel = 'gaming';
    game.G[game.N.mapText] = original;
    session.setEditor(false); session.forgetDocument();
  }
});

test('editor: edits go into the running level, in any mode, and again after a restart; drag moves and resizes', async () => {
  const session = await consoleModule('editor/session.js');
  const { mouse, grabOf, dragPlace } = await consoleModule('editor/input.js');
  const { currentTransform, toScreen } = await consoleModule('../../../src/console/kernel/ui/overlay.ts');
  const original = game.G[game.N.mapText];
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  // A mouse event at a world point, through the screen the way a real one comes in.
  const at = (p, extra = {}) => { const s = toScreen(currentTransform(), p); return { button: 0, clientX: s.x, clientY: s.y, ...extra }; };
  try {
    // In a match (the fake game is one): the editor does not care which mode it is.
    game.run('editor on');
    const doc = session.editorDoc();
    const region = doc.byUid('#red_use'); // region #1: 400, 0, 20 x 20
    const live = game.G[game.N.regions][1];

    // Live: the game's region moves at once. The game's map text is never written.
    session.select(region);
    assert.deepEqual(quiet('editor set x 450'), ['#red_use: x = "450", live now']);
    assert.equal(live.x, 450);
    assert.equal(game.G[game.N.mapText], original);
    assert.equal(session.editorDoc(), doc, 'the editor keeps its document');
    quiet('editor set use_on 12');
    assert.equal(live[game.N.regionUseOn], 10, 'stored as the loader stores it');
    quiet('editor set use_target #locked');
    assert.equal(live[game.N.regionTrigger], game.triggers.findIndex((t) => t.uid === '#locked'));

    // Trigger actions are loaded again from the attributes.
    const trig = doc.byUid('#on_death');
    session.select(trig);
    quiet('editor set actions_1_targetB 5');
    const t = game.G[game.N.triggers][doc.ordinal(trig)];
    assert.deepEqual(t[game.N.trigTargetB], [5]);
    quiet('editor set enabled false');
    assert.equal(t[game.N.trigEnabled], false);

    // A decoration moves at once, unless a movable carries it.
    const stone = doc.elements.find((e) => e.tag === 'decor' && !e.attrs.uid);
    session.select(stone);
    assert.deepEqual(quiet('editor set x 720'), ['decoration #1: x = "720", live now']);
    assert.equal(game.G[game.N.decors][1].x, 720);
    quiet('editor set r 45');
    assert.equal(game.G[game.N.decors][1].rotation, 45);
    session.select(doc.byUid('#sign'));
    assert.match(quiet('editor set x 230')[0], /not in the running level: /, 'carried by a movable, and no game loader to build it again here');

    // Not live: kept for "editor save", and it says why.
    const door = doc.byUid('#door_a');
    session.select(door);
    assert.match(quiet('editor set w 60')[0], /^#door_a: w = "60", not in the running level: .* \(kept for "editor save"\)/);
    assert.equal(session.pendingCount(), 2);
    assert.match(errorsOf(game.run('editor set x abc'))[0], /x must be a number/);
    assert.match(errorsOf(game.run('editor set c "a"b"'))[0], /cannot contain a double quote/);

    // Drag: press on the selection, move, let go. Snaps to 10.
    mouse.down(at({ x: 210, y: 50 }));
    mouse.move(at({ x: 233, y: 64 }));
    mouse.up();
    assert.deepEqual([door.attrs.x, door.attrs.y, door.attrs.w], ['220', '10', '60']);
    // Its right edge resizes; Alt does not snap.
    assert.equal(grabOf(door, { x: 220, y: 10, w: 60, h: 100 }, { x: 279, y: 50 }, 3), 'r');
    assert.equal(grabOf(door, { x: 220, y: 10, w: 60, h: 100 }, { x: 221, y: 11 }, 3), 'lt');
    mouse.down(at({ x: 279, y: 50 }));
    mouse.move(at({ x: 301.5, y: 50 }, { altKey: true }));
    mouse.up();
    assert.deepEqual([door.attrs.x, door.attrs.w], ['220', '82.5']);
    assert.deepEqual(dragPlace({ x: 0, y: 0, w: 10, h: 10 }, 'l', 30, 0, false), { x: 10, y: 0, w: 20, h: 10 }, 'dragged past the far edge: flips');
    // An object that is not selected: the press selects it and the same press drags it.
    session.select(null);
    mouse.down(at({ x: 240, y: 60 }));
    assert.equal(session.selected(), door, 'selected on the press');
    mouse.move(at({ x: 260, y: 60 }));
    mouse.up();
    assert.equal(door.attrs.x, '240', 'and moved by the same press');
    mouse.down(at({ x: 250, y: 60 }));
    mouse.up();
    assert.equal(session.selected(), door, 'a click on the selection with nothing below it keeps it');
    quiet('editor undo');
    // A click without moving selects what is under it instead.
    mouse.down(at({ x: 400 + 50, y: 10 }));
    mouse.up();
    assert.equal(session.selected(), region);

    // The level starts again on the same map (dying, a new round): the game builds it
    // from its map text, without the edits, and the editor puts them in again.
    live.x = 400;
    live[game.N.regionUseOn] = 9;
    game.G.stage.currentFrameLabel = 'loading'; game.frame();
    game.G.stage.currentFrameLabel = 'gaming'; game.frame();
    assert.equal(session.editorDoc(), doc, 'same map: same document');
    assert.equal(live.x, 450, 'the edit is back');
    assert.equal(live[game.N.regionUseOn], 10);
    assert.equal(game.G[game.N.decors][1].rotation, 45);
    assert.equal(game.G[game.N.mapText], original);
    assert.equal(game.run('editor reload')[0].startsWith('error: '), true, 'no reload command');

    // Save goes to the wrapper (none in tests).
    game.log.printed.length = 0;
    game.G.pb2dev.run('editor save my map');
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(game.log.printed.some((l) => /could not save \(no desktop wrapper in tests\)/.test(l)), game.log.printed.join(' | '));
    assert.match(errorsOf(game.run('editor save'))[0], /usage: editor save <name>/);
  } finally {
    session.setEditor(false); session.forgetDocument();
    game.G[game.N.mapText] = original;
  }
});

test('editor tools: place, copy, delete and undo; live edits still reach the right game object', async () => {
  const session = await consoleModule('editor/session.js');
  const { mouse } = await consoleModule('editor/input.js');
  const { currentTransform, toScreen } = await consoleModule('../../../src/console/kernel/ui/overlay.ts');
  const original = game.G[game.N.mapText];
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  const at = (p, extra = {}) => { const s = toScreen(currentTransform(), p); return { button: 0, clientX: s.x, clientY: s.y, ...extra }; };
  try {
    game.run('editor on');
    const doc = session.editorDoc();
    const walls = () => doc.byTag('box').length;
    const before = walls();

    // Through the page, the way a real click arrives: pointer events on the game canvas,
    // whose own pointerdown listener (the game's graphics library) cancels them, so no
    // mouse event follows. The editor hears them first and keeps them from the game.
    const canvas = game.G.game_canvas;
    const shown = (p) => { const s = toScreen(currentTransform(), p); return { clientX: s.x, clientY: s.y }; };
    let reachedGame = 0;
    canvas.addEventListener('pointerdown', () => { reachedGame++; });
    game.G.onpointerdown = () => { reachedGame++; };
    const down = game.dispatch(canvas, 'pointerdown', shown({ x: 215, y: 50 }));
    game.dispatch(canvas, 'pointerup', shown({ x: 215, y: 50 }));
    assert.equal(session.selected(), doc.byUid('#door_a'), 'a real click selects');
    assert.ok(down.defaultPrevented && reachedGame === 0, 'the game never sees the click');
    delete game.G.onpointerdown;
    // A press on the editor's own panels is theirs, not a click in the world.
    const panel = game.G[game.N.uiOverlay].overlay.childNodes.find((n) => n.pb2devUi);
    game.dispatch(panel, 'pointerdown', shown({ x: 215, y: 50 }));
    game.dispatch(panel, 'pointerup', shown({ x: 215, y: 50 }));
    assert.equal(session.selected(), doc.byUid('#door_a'), 'unchanged');
    assert.match(game.run('editor status').join('\n'), /last press the window saw: .* left alone/);
    session.select(null);

    // Place tool: drag out a wall (snapped), click for a default-sized one.
    quiet('editor tool place wall');
    mouse.down(at({ x: 1003, y: 498 }));
    mouse.move(at({ x: 1150, y: 560 }));
    assert.deepEqual(session.placePreview(), { tag: 'box', x: 1000, y: 500, w: 150, h: 60 });
    mouse.up();
    assert.equal(walls(), before + 1);
    const wall = session.selected();
    assert.deepEqual(wall.attrs, { x: '1000', y: '500', w: '150', h: '60', m: '0' });
    assert.equal(session.placePreview(), null);
    mouse.down(at({ x: 2000, y: 0 }));
    mouse.up();
    assert.deepEqual([session.selected().attrs.w, session.selected().attrs.h], ['100', '100']);
    assert.match(doc.toText(), /<box x="2000" y="0" w="100" h="100" m="0" \/>/, 'in the map, for "editor save"');
    assert.deepEqual(game.press('Escape'), []);
    assert.equal(session.currentTool(), 'select', 'Esc: back to select');
    // F8 off and on again: the placed walls are still there and can be selected.
    game.press('F8'); game.press('F8');
    assert.equal(session.editorDoc(), doc, 'the same document');
    assert.equal(walls(), before + 2);
    assert.equal(session.pickAt({ x: 2050, y: 50 })?.attrs.x, '2000');

    // Add by command, with a uid numbered like the map editor's; copy gets the next one.
    assert.match(quiet('editor add region 100 200 50 50')[0], /^Added #region\*1 at 100, 200 \(50 x 50\)/);
    game.press('KeyD', { ctrlKey: true });
    assert.equal(session.selected().attrs.uid, '#region*2');
    assert.deepEqual([session.selected().attrs.x, session.selected().attrs.y], ['120', '220']);

    // Deleting a region does not shift the others in the game: the game still has it.
    session.select(doc.byUid('#button')); // region #0
    game.press('Delete');
    assert.equal(doc.byUid('#button'), null);
    const redUse = doc.byUid('#red_use');
    assert.equal(doc.ordinal(redUse), 0, 'first region of the map now');
    session.select(redUse);
    quiet('editor set y 30');
    assert.equal(game.G[game.N.regions][1].y, 30, 'still the game\'s region #1');
    assert.deepEqual([game.G[game.N.regions][0].x, game.G[game.N.regions][0][game.N.regionUseOn]], [1e7, 0], 'the deleted one out of play, the others where they were');
    // New elements are not in the game: never live.
    session.select(doc.byUid('#region*1'));
    assert.match(quiet('editor set x 150')[0], /not in the running level: it is not in the running level yet/);

    // Undo: one step per action; a whole drag is one.
    session.select(wall);
    mouse.down(at({ x: 1075, y: 530 }));
    mouse.move(at({ x: 1100, y: 530 }));
    mouse.move(at({ x: 1125, y: 530 }));
    mouse.up();
    assert.equal(wall.attrs.x, '1050');
    game.press('KeyZ', { ctrlKey: true });
    assert.equal(wall.attrs.x, '1000', 'the drag, at once');
    game.press('KeyY', { ctrlKey: true });
    assert.equal(wall.attrs.x, '1050');
    quiet('editor undo'); // the drag
    quiet('editor undo'); // x 150 of #region*1
    quiet('editor undo'); // y 30
    assert.equal(game.G[game.N.regions][1].y, 0, 'undo goes live too');
    quiet('editor undo'); // the delete
    assert.equal(doc.ordinal(doc.byUid('#button')), 0, 'back where it was');
    assert.equal(session.selected(), doc.byUid('#button'));
    while (session.editorDoc().byTag('box').length > before) quiet('editor undo');
    assert.equal(doc.byUid('#region*1'), null);
    assert.equal(game.run('editor undo')[0], 'Nothing to undo');
    assert.equal(doc.toText(), original, 'the map as it was');

    assert.match(errorsOf(game.run('editor add nonsense'))[0], /usage: editor add <kind>/);
    session.select(null);
    assert.match(errorsOf(game.run('editor delete'))[0], /select an object first/);
  } finally {
    session.setTool('select');
    session.setEditor(false); session.forgetDocument();
    game.G[game.N.mapText] = original;
  }
});

test('editor: walls (with trims), backgrounds, water, pushers and movables move in the running level', async () => {
  const session = await consoleModule('editor/session.js');
  const original = game.G[game.N.mapText];
  const G = game.G, N = game.N;
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  // A level as the game holds it after loading: two walls, a background, water, a
  // pusher and a movable.
  G[N.mapText] = [
    '<box x="0" y="0" w="200" h="20" m="0" />',
    '<box x="300" y="0" w="100" h="40" m="0" />',
    '<bg x="0" y="100" w="50" h="50" m="0" />',
    '<water uid="#pool" x="600" y="0" w="100" h="50" damage="0" friction="true" />',
    '<pushf uid="#fan" x="800" y="0" w="40" h="40" tox="0" toy="-1" stab="0" damage="0" attach="-1" />',
    '<door uid="#lift" x="500" y="0" w="40" h="10" moving="false" tarx="500" tary="-100" maxspeed="10" vis="true" attach="-1" />',
  ].join('\n');
  G[N.wallX] = [0, 300]; G[N.wallY] = [0, 0]; G[N.wallW] = [200, 100]; G[N.wallH] = [20, 40]; G[N.wallCount] = 2;
  // The loader's grid: 100-unit cells, from 200 left of and above the walls.
  Object.assign(G, { [N.gridCell]: 100, [N.gridMinX]: -200, [N.gridMinY]: -200, [N.gridCols]: 12, [N.gridRows]: 6 });
  G[N.grid] = Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => []));
  G[N.gridAddWall] = (i) => {
    const x0 = Math.floor((G[N.wallX][i] - 100 + 200) / 100), x1 = Math.ceil((G[N.wallX][i] + G[N.wallW][i] + 100 + 200) / 100);
    const y0 = Math.floor((G[N.wallY][i] - 100 + 200) / 100), y1 = Math.ceil((G[N.wallY][i] + G[N.wallH][i] + 100 + 200) / 100);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) G[N.grid][x][y].push(i);
  };
  G[N.gridAddWall](0); G[N.gridAddWall](1);
  // The drawn layers: a wall body each, and one shared sprite with a background's
  // rectangle and wall #1's top and bottom trims, as the loader records the calls.
  G.texture_front0 = class {};
  const body = Object.assign(new G.texture_front0(), { x: 300, y: 0, scaleX: 1, scaleY: 0.4 });
  const fill = (ty, tx = 0) => ['beginBitmapFill', [{}, { tx, ty }, true, true]];
  const quad = (x1, y1, x2, y2) => [['moveTo', [x1, y1]], ['lineTo', [x2, y1]], ['lineTo', [x2, y2]], ['lineTo', [x1, y2]], ['endFill', []]];
  let scheduled = 0;
  const shared = { graphics: { bounds: { x1: 0, y1: 0, x2: 0, y2: 0 }, ScheduleBitmapUpdate() { scheduled++; }, draw_operations: [
    fill(100), ...quad(0, 100, 50, 150), // the background
    fill(0), ...quad(300, 0, 400, 16), // wall #1, top
    fill(24), ...quad(300, 24, 400, 40), // wall #1, bottom (40 - 16)
    fill(0), ...quad(0, 0, 200, 16), // wall #0, top: not wall #1's
  ] } };
  G.graphics_3d = { children: [body, shared] };
  const pool = { x: 600, y: 0, scaleX: 1, scaleY: 0.5 };
  G[N.waters] = [pool]; G[N.waterCount] = 1;
  G[N.waterX] = [590]; G[N.waterY] = [0]; G[N.waterW] = [120]; G[N.waterH] = [60]; G[N.waterDamage] = [0];
  G[N.bgX] = [0]; G[N.bgY] = [100]; G[N.bgW] = [50]; G[N.bgH] = [50]; G[N.bgCount] = 1;
  Object.assign(G, { [N.pushX1]: [800], [N.pushY1]: [0], [N.pushX2]: [840], [N.pushY2]: [40], [N.pushCount]: 1,
    [N.pushToX]: [0], [N.pushToY]: [-1], [N.pushStab]: [0], [N.pushDamage]: [0] });
  const lift = { x: 500, y: 0, w: 40, h: 10, scaleX: 0.4, scaleY: 0.1, tarx: 500, tary: -100 };
  G[N.doors] = [lift]; G[N.doorCount] = 1;
  // The cells wall i is in, against the cells the game's own function would put it in.
  const cellsOf = (grid, i) => grid.flatMap((col, x) => col.map((cell, y) => (cell.includes(i) ? `${x},${y}` : null))).filter(Boolean);
  const freshCells = (i) => {
    const real = G[N.grid];
    G[N.grid] = real.map((col) => col.map(() => []));
    G[N.gridAddWall](i);
    const want = cellsOf(G[N.grid], i);
    G[N.grid] = real;
    return want;
  };
  const ops = () => shared.graphics.draw_operations;
  const points = (from, n = 4) => ops().slice(from, from + n).map((op) => op[1].slice(0, 2));
  try {
    game.run('editor on');
    level(false); level(true);
    const doc = session.editorDoc();

    // A wall, in a match: arrays, grid, body, trims. Its height: the top stays, the bottom
    // trim follows the bottom edge.
    const wall = doc.byTag('box')[1];
    session.select(wall);
    assert.deepEqual(quiet('editor set h 60'), ['wall #1: h = "60", live now']);
    assert.equal(G[N.wallH][1], 60);
    assert.equal(body.scaleY, 0.6);
    assert.deepEqual(points(7), [[300, 0], [400, 0], [400, 16], [300, 16]], 'top trim stays');
    assert.deepEqual(points(13), [[300, 44], [400, 44], [400, 60], [300, 60]], 'bottom trim moves down 20');
    assert.equal(ops()[12][1][1].ty, 44, 'its texture with it');
    // Moved: everything of it goes along; wall #0's trim stays.
    quiet('editor set x 350');
    assert.deepEqual([G[N.wallX][1], body.x], [350, 350]);
    assert.deepEqual(points(7)[0], [350, 0]);
    assert.deepEqual(points(13)[0], [350, 44]);
    assert.deepEqual(points(19)[0], [0, 0], 'the other wall\'s trim untouched');
    assert.deepEqual(cellsOf(G[N.grid], 1), freshCells(1), 'in exactly the cells the game lists it in');
    assert.deepEqual(cellsOf(G[N.grid], 0), freshCells(0), 'the other wall untouched');
    // Wider: trims stretch with it.
    quiet('editor set w 200');
    assert.deepEqual(points(7), [[350, 0], [550, 0], [550, 16], [350, 16]]);
    assert.ok(scheduled > 0, 'the layer is redrawn');
    assert.match(quiet('editor set x 5000')[0], /not in the running level: that is outside the area the level's walls were built for/);
    assert.equal(G[N.wallX][1], 350);
    quiet('editor undo');

    // A background: its arrays and its drawn rectangle.
    session.select(doc.byTag('bg')[0]);
    assert.deepEqual(quiet('editor set y 120'), ['background #0: y = "120", live now']);
    assert.deepEqual(points(1), [[0, 120], [50, 120], [50, 170], [0, 170]]);
    assert.equal(G[N.bgY][0], 120);

    // Water: shown at the map's place, acting on a wider area, as the loader does.
    session.select(doc.byUid('#pool'));
    quiet('editor set w 200');
    assert.deepEqual([pool.scaleX, G[N.waterX][0], G[N.waterW][0], G[N.waterH][0]], [2, 590, 220, 60]);
    // Its damage builds it again (shown as acid): that test has a loader with water.

    // A pusher: its corners and its push.
    session.select(doc.byUid('#fan'));
    quiet('editor set x 820');
    assert.deepEqual([G[N.pushX1][0], G[N.pushX2][0]], [820, 860]);
    quiet('editor set toy -3');
    assert.equal(G[N.pushToY][0], -3);

    // A movable: place, size and destination.
    session.select(doc.byUid('#lift'));
    quiet('editor set w 80');
    quiet('editor set tary -200');
    assert.deepEqual([lift.w, lift.scaleX, lift.tary], [80, 0.8, -200]);

    // A new wall: its arrays, its grid cells and a body, as the loader makes one.
    G.graphics_3d.numChildren = G.graphics_3d.children.length;
    G.graphics_3d.addChildAt = function addChildAt(child) { this.children.push(child); child.parent = this; return child; };
    G.graphics_3d.removeChild = function removeChild(child) { this.children.splice(this.children.indexOf(child), 1); };
    G[N.displayInit] = (shown) => { shown.mouseEnabled = false; };
    G[N.wallMaterial] = ['0', '0'];
    game.run('editor add wall 100 100 50 20');
    const newWall = session.selected();
    assert.equal(newWall.live.index, 2);
    assert.deepEqual([G[N.wallCount], G[N.wallX][2], G[N.wallW][2]], [3, 100, 50]);
    assert.deepEqual(cellsOf(G[N.grid], 2), freshCells(2), 'in the grid');
    const newBody = G.graphics_3d.children.at(-1);
    assert.deepEqual([newBody.x, newBody.scaleX, newBody.mouseEnabled], [100, 0.5, false]);
    // Deleted: out of the grid, no size, its body gone.
    game.press('Delete');
    assert.deepEqual(cellsOf(G[N.grid], 2), []);
    assert.equal(G[N.wallW][2], 0);
    assert.ok(!G.graphics_3d.children.includes(newBody));
    game.run('editor undo'); game.run('editor undo');

    // The level starts again on the same map: the game rebuilds it without the edits,
    // and the editor puts them in again.
    G[N.wallX] = [0, 300]; G[N.wallW] = [200, 100]; G[N.wallH] = [20, 40];
    G[N.grid] = Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => []));
    G[N.gridAddWall](0); G[N.gridAddWall](1);
    Object.assign(body, { x: 300, scaleX: 1, scaleY: 0.4 });
    lift.w = 40; G[N.pushToY][0] = -1;
    level(false); level(true);
    assert.deepEqual([G[N.wallX][1], G[N.wallW][1], G[N.wallH][1], body.x], [350, 200, 60, 350], 'the wall again');
    assert.deepEqual(cellsOf(G[N.grid], 1), freshCells(1));
    assert.deepEqual([lift.w, G[N.pushToY][0]], [80, -3]);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    for (const k of ['doors', 'doorCount', 'wallCount', 'waters', 'waterCount', 'bgCount', 'pushCount']) delete G[N[k]];
    delete G.graphics_3d;
  }
});

test('editor: a trigger\'s actions are added, changed and removed, or edited as the map editor\'s text', async () => {
  const session = await consoleModule('editor/session.js');
  const { actionsOf, actionValues, triggerText, valuesFromText } = await consoleModule('editor/actions.js');
  const { setAttrs, undo } = await consoleModule('editor/edit.js');
  const original = game.G[game.N.mapText];
  const level = (on) => { game.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  try {
    game.run('editor on');
    game.G[game.N.mapText] = '<trigger uid="#t" x="0" y="0" enabled="true" maxcalls="1" actions_1_type="100" actions_1_targetA="a" actions_1_targetB="1" actions_2_type="-1" actions_2_targetA="" actions_2_targetB="" actions_3_type="26" actions_3_targetA="#clock" actions_3_targetB="0" />';
    level(false); level(true);
    const t = session.editorDoc().byUid('#t');
    // Empty slots (type -1) are not actions.
    assert.deepEqual(actionsOf(t.attrs), [{ type: '100', A: 'a', B: '1' }, { type: '26', A: '#clock', B: '0' }]);
    // The text view, as the map editor writes it.
    assert.equal(triggerText(t.attrs), 'uid: #t\nenabled: true\nmaxcalls: 1\n\nSetVar( "a", "1" );\nTimerDisable( "#clock", "0" );');
    // Add one: renumbered from 1, the empty slot gone; one undo step.
    setAttrs(t, actionValues(t.attrs, [...actionsOf(t.attrs), { type: 0, A: '#door', B: '#spot' }]));
    assert.deepEqual([t.attrs.actions_2_type, t.attrs.actions_3_type, t.attrs.actions_3_targetB], ['26', '0', '#spot']);
    assert.ok(!t.attrs.actions_4_type);
    undo();
    assert.equal(t.attrs.actions_2_type, '-1', 'undo puts the slots back as they were');
    // Edit as text, apply: headers and actions replaced.
    setAttrs(t, valuesFromText(t.attrs, 'uid: #t\nenabled: false\nmaxcalls: -1\n\nMovableTo( "#door", "#spot" );'));
    assert.deepEqual([t.attrs.enabled, t.attrs.maxcalls, t.attrs.actions_1_type, t.attrs.actions_1_targetA], ['false', '-1', '0', '#door']);
    assert.ok(!('actions_2_type' in t.attrs) && !('actions_3_type' in t.attrs));
    assert.throws(() => valuesFromText(t.attrs, 'Nope( "a", "b" );'), /unknown action "Nope"/);
    // The params panel in text mode: the text view and its Apply.
    const { setTriggersAsText } = await consoleModule('editor/trigger-panel.js');
    setTriggersAsText(true);
    session.select(null); session.select(t);
    const texts = textsOf(game.G[game.N.uiOverlay].overlay);
    assert.ok(texts.includes('Edit triggers as text:') && texts.includes('Apply') && texts.includes('Edit triggers as param list'));
    setTriggersAsText(false);
    // A trigger with no actions at all is fine too.
    setAttrs(t, valuesFromText(t.attrs, 'uid: #t'));
    assert.deepEqual(actionsOf(t.attrs), []);
  } finally {
    session.setEditor(false); session.forgetDocument();
    game.G[game.N.mapText] = original;
  }
});

test('editor: Params shows every parameter of the kind, with the editor\'s titles, defaults and values', async () => {
  const session = await consoleModule('editor/session.js');
  const original = game.G[game.N.mapText];
  const level = (on) => { game.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  try {
    game.run('editor on');
    game.G[game.N.mapText] = '<region x="0" y="0" w="10" h="10" use_on="1" />'; // an old map: no uid, no use_target, no attach
    level(false); level(true);
    session.select(session.editorDoc().byTag('region')[0]);
    const texts = textsOf(game.G[game.N.uiOverlay].overlay);
    for (const t of ['ID', 'X', 'Activation Trigger', 'Activation on', 'attach', "1 (''USE'' key (with button))", '-1']) {
      assert.ok(texts.includes(t), `${t}: ${texts.slice(-30).join(' | ')}`);
    }
  } finally {
    session.setEditor(false); session.forgetDocument();
    game.G[game.N.mapText] = original;
  }
});

test('editor: an object parameter is picked by clicking the object in the world, as in the map editor', async () => {
  const session = await consoleModule('editor/session.js');
  const { drawEditorFrame } = await consoleModule('editor/view.js');
  const { currentTransform, toScreen } = await consoleModule('../../../src/console/kernel/ui/overlay.ts');
  const overlay = game.G[game.N.uiOverlay].overlay;
  // The node whose own text is `text`, and the params row it is in.
  const find = (node, text) => {
    if (node.text === text) return node;
    for (const n of node.childNodes || []) { const hit = typeof n === 'object' && find(n, text); if (hit) return hit; }
    return null;
  };
  const valueCell = (label) => find(overlay, label).parent.childNodes[1];
  const shown = (p) => { const s = toScreen(currentTransform(), p); return { clientX: s.x, clientY: s.y }; };
  const click = (p) => { game.dispatch(game.G.game_canvas, 'pointerdown', shown(p)); game.dispatch(game.G.game_canvas, 'pointerup', shown(p)); };
  try {
    game.run('editor on');
    const doc = session.editorDoc();
    const region = doc.byUid('#red_use');
    session.select(region);
    game.dispatch(valueCell('Activation Trigger'), 'click', {});
    assert.deepEqual(session.currentPick().kinds, ['trigger']);
    assert.ok(drawEditorFrame().picks > 0, 'every trigger is marked');
    assert.match(textsOf(overlay).join('\n'), /use_target: click a trigger in the world {2}· {2}Esc: cancel/);
    click({ x: 120, y: 0 }); // #locked is at 120, 0
    assert.equal(region.attrs.use_target, '#locked');
    assert.equal(game.G[game.N.regions][1][game.N.regionTrigger], game.triggers.findIndex((t) => t.uid === '#locked'), 'live');
    assert.equal(session.currentPick(), null, 'done');
    assert.equal(session.selected(), region, 'the region stays selected');
    // Esc cancels one.
    game.dispatch(valueCell('Activation Trigger'), 'click', {});
    assert.ok(session.currentPick());
    game.press('Escape');
    assert.equal(session.currentPick(), null);
    assert.equal(session.selected(), region, 'Esc ends the pick, not the selection');
    // A trigger action's target: B of MovableTo is a region.
    const trigger = doc.byUid('#open_door');
    session.select(trigger);
    game.dispatch(valueCell('B (region)'), 'click', {});
    assert.deepEqual(session.currentPick().kinds, ['region']);
    click({ x: 50, y: 0 }); // the #open_door trigger is here: not a region
    assert.ok(session.currentPick(), 'only the kinds it takes');
    click({ x: 490, y: 10 }); // #spawn_spot: 480, 0, 20 x 20
    assert.equal(trigger.attrs.actions_2_targetB, '#spawn_spot');
    // A pick with nothing there keeps waiting.
    game.dispatch(valueCell('A (door)'), 'click', {});
    click({ x: 330, y: 150 }); // on screen, nothing there
    assert.ok(session.currentPick(), 'still waiting');
    game.press('Escape');
    game.run('editor undo'); game.run('editor undo');
  } finally {
    session.setEditor(false); session.forgetDocument();
  }
});

test('editor: the selection\'s connections are dashed lines as in the map editor: green out, white in', async () => {
  const session = await consoleModule('editor/session.js');
  const { drawEditorFrame } = await consoleModule('editor/view.js');
  const original = game.G[game.N.mapText];
  const level = (on) => { game.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  // The stroke colour and dash in force at each line drawn.
  const strokes = () => {
    const out = [];
    let color = null;
    let dash = [];
    for (const d of game.log.drawn) {
      if (d[0] === 'set' && d[1] === 'strokeStyle') color = d[2];
      if (d[0] === 'setLineDash') dash = d[1];
      if (d[0] === 'lineTo') out.push({ color, dash: dash.length > 0 });
    }
    return out;
  };
  try {
    game.run('editor on');
    game.G[game.N.mapText] = [
      '<trigger uid="#t" x="0" y="0" enabled="true" maxcalls="1" actions_1_type="26" actions_1_targetA="#clock" actions_1_targetB="0" />',
      '<timer uid="#clock" x="100" y="0" enabled="true" maxcalls="-1" target="#t" delay="30" />',
    ].join('\n');
    level(false); level(true);
    session.select(session.editorDoc().byUid('#t'));
    game.log.drawn.length = 0;
    assert.equal(drawEditorFrame().links, 2, 'it disables the timer; the timer runs it');
    const lines = strokes();
    assert.ok(lines.some((l) => l.color === '#66ff66' && l.dash), 'green, dashed: what it points at');
    assert.ok(lines.some((l) => l.color === '#ffffff' && l.dash), 'white, dashed: what points at it');
    assert.ok(!game.log.drawn.some((d) => d[0] === 'closePath'), 'no arrowheads');
  } finally {
    session.setEditor(false); session.forgetDocument();
    game.G[game.N.mapText] = original;
  }
});

test('editor: an edit nothing finer takes rebuilds the object with the game\'s own loader code', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const G = game.G, N = game.N;
  // A frame2.js shaped like the game's: tags through its string table, a loop that
  // builds (a branch per kind, a counter each), a loop that resolves uids.
  G.$tagBox = 'box'; G.$tagRegion = 'region'; G.$tagDecor = 'decor';
  const frame2 = `
var a,b,c;
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
if(a==$tagRegion)
{
${N.regions}[$regionN]=new Object();
${N.regions}[$regionN]["x"]=parseFloat(b["#x"]);
${N.regions}[$regionN]["y"]=parseFloat(b["#y"]);
${N.regions}[$regionN].w=parseFloat(b["#w"]);
${N.regions}[$regionN].h=parseFloat(b["#h"]);
${N.regions}[$regionN].${N.regionTrigger}=b["#use_target"];
${N.regions}[$regionN].${N.regionUseOn}=parseInt(b["#use_on"]);
if(${N.regions}[$regionN].${N.regionUseOn}==1)
{
mc={ kind: "switch", parent: { removeChild(x) { x.gone = true; } } };
${N.regions}[$regionN].mc=mc;
}
$regionN++;
}
}
for(var $el of $doc.children())
{
if(a==$tagRegion)
{
${N.regions}[$regionR].${N.regionTrigger}="resolved " + ${N.regions}[$regionR].${N.regionTrigger};
$regionR++;
}
}
`;
  const regions = G[N.regions];
  G.$regionN = regions.length; G.$regionR = regions.length; G.$wallsBuilt = 0;
  G.a = 'the game\'s a'; G.mc = 'the game\'s mc';
  await loader.readLoader(async (url) => ({ ok: url === 'scripts/frame2.js', status: 200, text: async () => frame2 }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  assert.ok(loader.canRebuild('region') && !loader.canRebuild('gun'));
  try {
    game.run('editor on');
    const doc = session.editorDoc();
    const region = doc.byUid('#clock_switch'); // region #2 of 4, a use key
    session.select(region);
    game.run('editor set use_on 0'); // switch -> none: nothing finer can take it
    const before = regions[2];
    // Activation 0 -> 1: the game's region branch draws a USE switch.
    assert.deepEqual(game.run('editor set use_on 1').filter((l) => !l.startsWith('Note:')), ['#clock_switch: use_on = "1", live now']);
    assert.notEqual(regions[2], before, 'a new region object from the game\'s code');
    assert.equal(regions[2].mc.kind, 'switch');
    assert.equal(regions[2].x, 440);
    assert.equal(regions[2][N.regionTrigger], 'resolved #timer*2', 'the second loop ran too');
    assert.deepEqual([G.$regionN, G.$regionR], [regions.length, regions.length], 'counters as they were');
    assert.deepEqual([G.a, G.mc], ['the game\'s a', 'the game\'s mc'], 'its scratch globals as they were');
    // And back: the old switch comes off the screen.
    const sw = regions[2].mc;
    game.run('editor set use_on 0');
    assert.ok(sw.gone);
    assert.equal(regions[2].mc, undefined);

    // Adding one: the game's branch at the end of the regions, its counters moved on.
    const n = regions.length;
    game.run('editor add region 600 0 40 40');
    const added = session.selected();
    assert.equal(added.live.index, n);
    assert.equal(regions.length, n + 1);
    assert.deepEqual([regions[n].x, regions[n].w, G.$regionN, G.$regionR], [600, 40, n + 1, n + 1]);
    assert.equal(session.pendingCount(), 0, 'in the running level');
    // Deleting it: out of play, the others where they were; undo builds it again.
    game.press('Delete');
    assert.deepEqual([regions[n].x, regions.length], [1e7, n + 1]);
    game.run('editor undo');
    assert.equal(regions[n].x, 600, 'built again in its place');
    assert.equal(regions.length, n + 1);
    // The level starts over on the same map: the game builds its regions from the map
    // (no added one), and the editor adds it again.
    regions.length = n; G.$regionN = n; G.$regionR = n;
    game.G.stage.currentFrameLabel = 'menu'; game.frame();
    game.G.stage.currentFrameLabel = 'gaming'; game.frame();
    assert.deepEqual([regions.length, regions[n].x], [n + 1, 600], 'added again after the restart');
    // A deleted map region is taken out again after a restart too.
    session.select(doc.byUid('#spawn_spot'));
    game.press('Delete');
    regions[3].x = 480; // the game builds the level again from the map
    regions.length = n; G.$regionN = n; G.$regionR = n;
    game.G.stage.currentFrameLabel = 'menu'; game.frame();
    game.G.stage.currentFrameLabel = 'gaming'; game.frame();
    assert.equal(regions[3].x, 1e7, 'still out of play');
    assert.equal(regions[n].x, 600, 'and the added one added again');
    game.run('editor undo');
    game.run('editor undo'); // the add
    assert.equal(regions[n].x, 1e7);
  } finally {
    session.setEditor(false); session.forgetDocument();
    for (const k of ['$tagBox', '$tagRegion', '$tagDecor', '$regionN', '$regionR', '$wallsBuilt']) delete G[k];
  }
});

test('editor: a map gun moves, changes model, is deleted and comes back in the running level', async () => {
  const session = await consoleModule('editor/session.js');
  const G = game.G, N = game.N;
  const original = G[N.mapText];
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  // A rifle lying on the map (fallen a little since), with its two physics points, and
  // one a character holds.
  const X = G[N.ptX], Y = G[N.ptY], PX = G[N.ptPrevX], PY = G[N.ptPrevY];
  X[20] = 100; Y[20] = 30; X[21] = 110; Y[21] = 30; PX[20] = 100; PY[20] = 30; PX[21] = 110; PY[21] = 30;
  const rifle = { model: 'gun_rifle', x: 100, y: 30, picken_by: -1, [N.gunPtA]: 20, [N.gunPtB]: 21 };
  const held = { model: 'gun_rifle', x: 101, y: 0, picken_by: 0 };
  G[N.guns] = [held, rifle];
  const made = [];
  const factory = G[N.gunFactory];
  G[N.gunFactory] = (model, params) => { const g = { model, x: params.x, y: params.y, upg: params.upg, picken_by: -1 }; made.push(g); G[N.guns].push(g); return g; };
  try {
    G[N.mapText] = '<gun uid="#rifle" x="100" y="0" model="gun_rifle" command="-1" upg="0" />';
    game.run('editor on');
    level(false); level(true);
    const gun = session.editorDoc().byUid('#rifle');
    session.select(gun);
    // Moved: its points go along, the held one is not touched.
    assert.deepEqual(quiet('editor set x 300'), ['#rifle: x = "300", live now']);
    assert.deepEqual([rifle.x, X[20], X[21], PX[20]], [300, 300, 310, 300]);
    assert.equal(held.x, 101);
    // A new model: a new gun from the game's factory where it lies; the old one out of play.
    assert.deepEqual(quiet('editor set model gun_sniper'), ['#rifle: model = "gun_sniper", live now']);
    assert.deepEqual([made.length, made[0].model, made[0].x], [1, 'gun_sniper', 300]);
    assert.ok(rifle.x >= 1e7 && rifle.visible === false);
    // Deleted, and back with undo where the map puts it.
    game.press('Delete');
    assert.ok(made[0].x >= 1e7);
    game.run('editor undo');
    assert.deepEqual([made.length, made[1].model, made[1].x], [2, 'gun_sniper', 300]);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.gunFactory] = factory;
    G[N.guns] = [];
    G[N.mapText] = original;
  }
});

test('editor: decoration models and character skins are offered as the editor offers them, with their pictures', async () => {
  const { dropdownItems } = await consoleModule('editor/params.js');
  const table = globalThis.PB2_OPCODES;
  table.values.decor_model = { stone: 'Stone', ship: 'Broken ship' };
  table.values.char = { 1: 'Campaign Hero model', 77: 'Raven', '-1': 'Death Match model' };
  try {
    const decor = dropdownItems('decor_model');
    assert.deepEqual(decor.map((i) => [i.value, i.label, i.picture.src]), [
      ['stone', 'Stone', '/level_editor/decors/stone.png'], ['ship', 'Broken ship', '/level_editor/decors/ship.png'],
    ]);
    const skins = dropdownItems('char');
    assert.deepEqual(skins.map((i) => [i.value, i.picture?.src ?? null]), [
      ['1', '/level_editor/chars_full/char0001.png'], ['77', '/level_editor/chars_full/char0077.png'], ['-1', null],
    ]);
  } finally {
    delete table.values.decor_model;
    delete table.values.char;
  }
});

test('editor: a lamp is found by its place, built again in its slot, its light and flare drawn with the game\'s code', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const vm = await import('node:vm');
  const G = game.G, N = game.N;
  const original = G[N.mapText];
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  // Like the game's: tags and attribute names through its string table, the light loop
  // counting with a script-level "let", the lightmap drawn by a function of its own.
  G.$tagBox = 'box'; G.$tagLamp = 'lamp'; G.$strX = '#x';
  vm.runInThisContext('let $lampLoop = 0;');
  const frame2 = `
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
if(a==$tagLamp)
{
$lampX[$lampN]=parseFloat(b[$strX]);
$lampY[$lampN]=parseFloat(b["#y"]);
$lampP[$lampN]=Math.min(parseFloat(b["#power"]),100);
$lampS[$lampN]=2;
if(b["#flare"]=="true"||parseFloat(b["#flare"])>0)
{
}
else
$lampS[$lampN]=-1;
if($lampS[$lampN]==2||$inBg($lampX[$lampN],$lampY[$lampN]))
{
$lampN++;
}
}
}
for(i2=0;i2<$lampN;i2++)
{
if($lampS[i2]===2)
{
$flares[$flareN]=graphics_3d_front.addChildAt(new lens_flare,graphics_3d_front.numChildren);
$flares[$flareN]["x"]=$lampX[i2];
$flares[$flareN]["y"]=$lampY[i2];
$flareN++;
}
}
for($lampLoop=0;$lampLoop<$lampN;$lampLoop++)
{
var g={ createRadialGradientAndBeginFill() {} };
g.createRadialGradientAndBeginFill($lampX[$lampLoop],$lampY[$lampLoop]);
$shapes[$lampLoop]={ x: $lampX[$lampLoop], power: $lampP[$lampLoop] };
}
function $drawLights(full)
{
$drawn=[];
for(var k=0;k<$lampN;k++)
if($lampS[k]!=0)
{
$lightmap.drawWithQuality($shapes[k]);
$drawn.push($shapes[k]);
}
}
`;
  // Slot 0: a light of the game's own (along a wall); slot 1: the map's lamp.
  Object.assign(G, {
    $wallsBuilt: 0, $lampX: [7, 100], $lampY: [7, 50], $lampP: [0.45, 0.4], $lampS: [-1, 2], $lampN: 2,
    $shapes: ['fill', 'lamp shape'], $flares: [{ x: 100, y: 50, visible: true, scaleX: 1, scaleY: 1 }], $flareN: 1, $drawn: [],
    $inBg: (x) => x < 200, $lightmap: { drawWithQuality() {} }, g: 'the game\'s g',
    graphics_3d_front: { numChildren: 0, addChildAt(o) { this.numChildren++; return o; } },
    lens_flare: class { constructor() { Object.assign(this, { visible: true, scaleX: 1, scaleY: 1 }); } },
  });
  G.$drawLights = vm.runInThisContext('(function $drawLights(){ $drawn=[]; for(var k=0;k<$lampN;k++) if($lampS[k]!=0) $drawn.push($shapes[k]); })');
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2 }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  try {
    G[N.mapText] = '<lamp uid="#l1" x="100" y="50" power="0.4" flare="1" />';
    game.run('editor on');
    level(false); level(true);
    const doc = session.editorDoc();
    session.select(doc.byUid('#l1'));
    // Moved: its own slot (1, not its place in the map), the old flare out, a new one, its light drawn.
    assert.deepEqual(quiet('editor set x 120'), ['#l1: x = "120", live now']);
    assert.deepEqual([G.$lampX, G.$lampN, G.$flares[0].visible], [[7, 120], 2, false]);
    assert.deepEqual([G.$flares[1].x, G.$flares[1].visible], [120, true]);
    assert.deepEqual(G.$shapes[1], { x: 120, power: 0.4 });
    assert.deepEqual(G.$drawn, ['fill', G.$shapes[1]], 'the lightmap drawn again');
    assert.equal(vm.runInThisContext('$lampLoop'), 0, 'the game\'s loop variable as it was');
    assert.equal(G.g, 'the game\'s g');
    // No flare: kept inside a background.
    quiet('editor set flare 0');
    assert.deepEqual([G.$lampS[1], G.$flares[1].visible], [-1, false]);
    // Out of every background without a flare: the loader does not keep it, it is put out.
    quiet('editor set x 300');
    assert.deepEqual([G.$lampS[1], G.$lampN], [0, 2]);
    assert.deepEqual(G.$drawn, ['fill']);
    assert.deepEqual(G.$shapes[1], { x: 300, power: 0 }, 'a light of nothing, if a new round lights it again');
    quiet('editor set x 150');
    assert.deepEqual([G.$lampX[1], G.$lampS[1], G.$lampN], [150, -1, 2], 'back in its slot');
    // Added: a new slot at the end, with its light and flare.
    game.run('editor add lamp 50 60');
    const added = session.selected();
    assert.deepEqual([G.$lampN, G.$lampX[2], G.$lampS[2], G.$shapes[2].x, G.$flares.at(-1).x], [3, 50, 2, 50, 50]);
    assert.equal(session.pendingCount(), 0, 'in the running level');
    game.press('Delete');
    assert.deepEqual([G.$lampS[2], G.$flares.at(-1).visible], [0, false]);
    game.run('editor undo');
    assert.equal(G.$lampS[2], 2, 'lit again');
    assert.equal(added.live.index, 2);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    for (const k of ['$tagBox', '$tagLamp', '$strX', '$wallsBuilt', '$lampX', '$lampY', '$lampP', '$lampS', '$lampN', '$shapes',
      '$flares', '$flareN', '$drawn', '$inBg', '$lightmap', 'g', 'graphics_3d_front', 'lens_flare', '$drawLights']) delete G[k];
  }
});

test('editor: an engine mark\'s parameter offers what its mark takes, as the editor\'s mark pairs say', async () => {
  const { paramInfo, dropdownItems } = await consoleModule('editor/params.js');
  const table = globalThis.PB2_OPCODES;
  const rows = [
    { name: 'mark', kind: 'engine_mark', title: 'Modificator', desc: 'Game modificator', cls: 'inf' },
    { name: 'forteam', kind: 'nochange', title: 'Parameter', desc: 'Modificator parameter', cls: 'inf' },
  ];
  table.params.push(...rows);
  Object.assign(table.markPairs, { sky: 'sky_model', he_nades_count: 'value>=0+round1' });
  table.values.sky_model = { 1: 'Yellow, dark', 5: 'Space' };
  try {
    assert.equal(paramInfo('inf', 'forteam', { mark: 'sky' }).kind, 'sky_model');
    assert.deepEqual(dropdownItems(paramInfo('inf', 'forteam', { mark: 'sky' }).kind).map((i) => [i.value, i.label, i.picture.src]),
      [['1', 'Yellow, dark', '/level_editor/pic.php?m=1&c=6'], ['5', 'Space', '/level_editor/pic.php?m=5&c=6']]);
    assert.equal(paramInfo('inf', 'forteam', { mark: 'he_nades_count' }).kind, 'value>=0+round1');
    assert.equal(paramInfo('inf', 'forteam', { mark: 'casual' }).kind, 'nochange', 'a mark the table leaves out: free text');
    assert.equal(paramInfo('inf', 'forteam', {}).kind, 'nochange', 'the default mark (hero1_guns)');
    assert.equal(paramInfo('inf', 'mark', { mark: 'sky' }).kind, 'engine_mark');
  } finally {
    table.params.splice(table.params.length - rows.length, rows.length);
    for (const k of Object.keys(table.markPairs)) delete table.markPairs[k];
    delete table.values.sky_model;
  }
});

test('editor: movables and water take every parameter in the running level, with the loader\'s later steps', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const vm = await import('node:vm');
  const G = game.G, N = game.N;
  const original = G[N.mapText];
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  // A frame2.js shaped like the game's: branches that make movables, regions and water,
  // then the later steps over all of them, each loop calling the loader's watchdog (which
  // throws once the level is built).
  G.$tagBox = 'box'; G.$tagDoor = 'door'; G.$tagRegion = 'region'; G.$tagWater = 'water';
  vm.runInThisContext('let $watch = () => { throw new Error("Map construction took longer than 15 seconds"); };');
  // Its counters are "$" names, like the game's; the console reads them by its own names.
  const [doors, doorCount, waters, waterCount] = [N.doors, '$doorN', N.waters, '$waterN'];
  for (const [mine, theirs] of [[N.doorCount, '$doorN'], [N.waterCount, '$waterN'], [N.regionCount, '$regionN']]) {
    Object.defineProperty(G, mine, { get: () => G[theirs], set: (v) => { G[theirs] = v; }, configurable: true });
  }
  const [wx, wy, ww, wh, wd] = [N.waterX, N.waterY, N.waterW, N.waterH, N.waterDamage];
  const frame2 = `
let $watch=()=>
{
let t=Date.now();
};
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
if(a==$tagWater)
{
${waters}[${waterCount}]=new water();
if(b["#attach"]!="-1"&&b["#attach"]!=""&&b["#attach"]!=undefined)
attachments.push({parent:b["#attach"],id:${waterCount},child:${waters}[${waterCount}],type:5});
${wx}[${waterCount}]=parseFloat(b["#x"]);
${wy}[${waterCount}]=parseFloat(b["#y"]);
${ww}[${waterCount}]=parseFloat(b["#w"]);
${wh}[${waterCount}]=parseFloat(b["#h"]);
${wd}[${waterCount}]=parseFloat(b["#damage"]);
$friction[${waterCount}]=(b["#friction"]!="0"&&b["#friction"]!="false");
${waterCount}++;
}
if(a==$tagDoor)
{
mc=graphics_3d.addChildAt(new door,graphics_3d.numChildren);
mc.visible=false;
if(b["#vis"]=="true")
mc.$vis=true;
else
mc.$vis=false;
mc.$startX=mc["x"]=parseFloat(b["#x"]);
mc.$startY=mc["y"]=parseFloat(b["#y"]);
mc.scaleX=parseFloat(b["#w"])/100;
mc.scaleY=parseFloat(b["#h"])/100;
${doors}[${doorCount}]=mc;
mc.w=parseFloat(b["#w"]);
mc.h=parseFloat(b["#h"]);
mc.$moving=(b["#moving"]=="true");
mc.$startTarX=mc["tarx"]=parseFloat(b["#tarx"]);
mc.$startTarY=mc["tary"]=parseFloat(b["#tary"]);
mc.$startSpeed=mc.$speed=parseFloat(b["#maxspeed"]);
mc.$sound=!(b["#mute"]==="true"||b["#mute"]==="1");
if(b["#attach"]!=="-1"&&b["#attach"]!==""&&b["#attach"]!==undefined)
attachments.push({parent:b["#attach"],child:mc,type:0});
${doorCount}++;
}
if(a==$tagRegion)
{
${N.regions}[$regionN]=new Object();
${N.regions}[$regionN]["x"]=parseFloat(b["#x"]);
${N.regions}[$regionN]["y"]=parseFloat(b["#y"]);
${N.regions}[$regionN].w=parseFloat(b["#w"]);
${N.regions}[$regionN].h=parseFloat(b["#h"]);
if(b["#attach"]!=="-1"&&b["#attach"]!==""&&b["#attach"]!==undefined)
attachments.push({parent:b["#attach"],child:${N.regions}[$regionN],type:4});
$regionN++;
}
}
for(var i=0;i<attachments.length;i++)
{
$watch();
attachments[i].parent=${doors}[$doorOf(attachments[i].parent)];
if(attachments[i]["type"]==5)
{
attachments[i].dx=${wx}[attachments[i].id]-attachments[i].parent["x"];
attachments[i].dy=${wy}[attachments[i].id]-attachments[i].parent["y"];
}
else
{
attachments[i].dx=attachments[i].child["x"]-attachments[i].parent["x"];
attachments[i].dy=attachments[i].child["y"]-attachments[i].parent["y"];
}
}
for(i=0;i<${waterCount};i++)
{
$watch();
if($friction[i])
{
$shown=graphics_3d_front.addChildAt(${waters}[i],0);
$shown["x"]=${wx}[i];
$shown["y"]=${wy}[i];
$shown.scaleX=${ww}[i]/100;
$shown.scaleY=${wh}[i]/100;
if(${wd}[i]>0)
$shown.gotoAndStop(1);
else
$shown.gotoAndStop(2);
}
${wx}[i]-=10;
${ww}[i]+=20;
${wh}[i]+=10;
}
for(i=0;i<${doorCount};i++)
{
if(${doors}[i].$vis)
{
mc=game.addChildAt(new veh_hh,game.numChildren);
mc["x"]=${doors}[i]["x"];
mc.$edgeOf=i;
mc=game.addChildAt(new veh_hh,game.numChildren);
mc["x"]=${doors}[i]["x"]+${doors}[i].w;
mc.$edgeOf=i;
}
}
for(i=0;i<${doorCount};i++)
if(${doors}[i].$vis)
{
$watch();
$tex=graphics_3d.addChildAt(new texture_front0,graphics_3d.numChildren);
$tex["x"]=${doors}[i]["x"];
$tex.scaleX=${doors}[i].scaleX;
$tex.scaleY=${doors}[i].scaleY;
$tex["y"]=${doors}[i]["y"];
${N.textureFollows}($tex,i);
}
function ${N.textureFollows}(clip,$door)
{
$tieN=$tieClips.length;
$tieClips[$tieN]=clip;
$tieDoors[$tieN]=$door;
}
function $moveTied(i,$speed,$interp=0)
{
for(var $k=0;$k<attachments.length;$k++)
if(attachments[$k].parent===${doors}[i])
{
attachments[$k].child["x"]=${doors}[i]["x"]+attachments[$k].dx;
attachments[$k].child["y"]=${doors}[i]["y"]+attachments[$k].dy;
}
}
`;
  const layer = () => ({ children: [], get numChildren() { return this.children.length; },
    addChildAt(o, at) { if (o.parent) o.parent.removeChild(o); this.children.splice(at, 0, o); o.parent = this; return o; },
    removeChild(o) { this.children.splice(this.children.indexOf(o), 1); o.parent = null; },
    clearMCInterpolationData() {} });
  const saved = { game: G.game, graphics_3d: G.graphics_3d, graphics_3d_front: G.graphics_3d_front, regions: G[N.regions], regionCount: G[N.regionCount] };
  const world = Object.assign(layer(), { x: saved.game.x, y: saved.game.y, scaleX: saved.game.scaleX, scaleY: saved.game.scaleY, parent: saved.game.parent });
  Object.assign(G, {
    graphics_3d: layer(), graphics_3d_front: layer(), game: world, attachments: [], $tieClips: [], $tieDoors: [], $friction: [], $wallsBuilt: 0,
    $regionN: 0, $doorOf: (uid) => G[doors].findIndex((d) => d.uid === uid),
    door: class { constructor() { this.uid = null; } }, water: class { gotoAndStop(f) { this.frame = f; } }, veh_hh: class {}, texture_front0: class {},
    [N.textureFollows]: (clip, door) => { G.$tieClips.push(clip); G.$tieDoors.push(door); },
    $moveTied: (i) => { for (const a of G.attachments) if (a.parent === G[doors][i]) { a.child.x = G[doors][i].x + a.dx; a.child.y = G[doors][i].y + a.dy; } },
    [doors]: [], $doorN: 0, [waters]: [], $waterN: 0, [wx]: [], [wy]: [], [ww]: [], [wh]: [], [wd]: [], [N.regions]: [],
    [N.displayInit]: () => {},
  });
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2 }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  // Uids as the game's own uid table would resolve them (the fake keeps it on the movable).
  const named = (uid) => { const d = G[doors][G[doors].length - 1]; d.uid = uid; };
  try {
    G[N.mapText] = '<box x="0" y="0" w="10" h="10" m="0" />';
    game.run('editor on');
    level(false); level(true);
    // Added: the movable, its texture (tied to it) and its two edges.
    assert.deepEqual(quiet('editor add door 500 0 40 10'), ['Added #door*1 at 500, 0 (40 x 10); in the running level']);
    const lift = session.selected();
    named(lift.attrs.uid);
    const tex = G.$tieClips[0];
    assert.deepEqual([G[doorCount], G.graphics_3d.children.includes(tex), G.$tieDoors[0], tex.x, tex.scaleX], [1, true, 0, 500, 0.4]);
    assert.equal(G.game.children.length, 2, 'two edges');
    // A region attached to it: tied as the loader ties it.
    game.run('editor add region 510 -20 20 20');
    const rider = session.selected();
    assert.deepEqual(quiet(`editor set attach ${lift.attrs.uid}`), [`${rider.attrs.uid}: attach = "${lift.attrs.uid}", live now`]);
    assert.equal(G.attachments.length, 1);
    assert.deepEqual([G.attachments[0].parent, G.attachments[0].dx, G.attachments[0].dy], [G[doors][0], 10, -20]);
    // The movable moved: its start copy for a new round, its texture, what rides on it.
    session.select(lift);
    assert.deepEqual(quiet('editor set x 600'), [`${lift.attrs.uid}: x = "600", live now`]);
    assert.deepEqual([G[doors][0].x, G[doors][0].$startX, tex.x, G[N.regions][0].x], [600, 600, 600, 610]);
    quiet('editor set tary -50');
    assert.deepEqual([G[doors][0].tary, G[doors][0].$startTarY], [-50, -50]);
    // Hidden: built again, its texture taken off, the rider tied to the new one.
    const before = G[doors][0];
    assert.deepEqual(quiet('editor set vis false'), [`${lift.attrs.uid}: vis = "false", live now`]);
    named(lift.attrs.uid);
    assert.notEqual(G[doors][0], before);
    assert.ok(!G.graphics_3d.children.includes(tex), 'no texture');
    assert.equal(G.attachments[0].parent, G[doors][0], 'the rider on the new one');
    // Shown again: the same texture back, no second pair of edges.
    quiet('editor set vis true');
    named(lift.attrs.uid);
    assert.deepEqual([G.graphics_3d.children.includes(tex), tex.x, G.game.children.length, G.$tieClips.length], [true, 600, 2, 1]);
    for (const [attr, v, field, want] of [['maxspeed', '20', '$speed', 20], ['moving', 'true', '$moving', true], ['mute', 'true', '$sound', false]]) {
      assert.deepEqual(quiet(`editor set ${attr} ${v}`), [`${lift.attrs.uid}: ${attr} = "${v}", live now`]);
      named(lift.attrs.uid);
      assert.equal(G[doors][0][field], want, attr);
    }
    assert.equal(G[doors][0].$startSpeed, 20);

    // Water: shown as water, its area widened, as the loader does once the map is read.
    game.run('editor add water 800 0 100 50');
    const pool = session.selected();
    const first = G[waters][0];
    assert.deepEqual([G.graphics_3d_front.children[0], first.frame, G[wx][0], G[ww][0], G[wh][0]], [first, 2, 790, 120, 60]);
    // Acid: built again and shown as acid, the area widened once.
    assert.deepEqual(quiet('editor set damage 5'), [`${pool.attrs.uid}: damage = "5", live now`]);
    assert.ok(!G.graphics_3d_front.children.includes(first), 'the old one off the screen');
    assert.deepEqual([G[waters][0].frame, G[wd][0], G[wx][0], G[ww][0], G[waterCount]], [1, 5, 790, 120, 1]);
    // No friction: not shown.
    quiet('editor set friction false');
    assert.deepEqual(G.graphics_3d_front.children, []);
    // Attached to the movable: tied by its index.
    quiet(`editor set attach ${lift.attrs.uid}`);
    const tie = G.attachments.find((a) => a.type === 5);
    assert.deepEqual([tie.id, tie.parent, tie.dx], [0, G[doors][0], 800 - 600]);
    assert.equal(session.pendingCount(), 0, 'all in the running level');
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    Object.assign(G, { game: saved.game, graphics_3d: saved.graphics_3d, graphics_3d_front: saved.graphics_3d_front, [N.regions]: saved.regions });
    for (const k of ['$tagBox', '$tagDoor', '$tagRegion', '$tagWater', 'attachments', '$tieClips', '$tieDoors', '$friction', '$wallsBuilt', '$regionN',
      '$doorOf', 'door', 'water', 'veh_hh', 'texture_front0', '$moveTied', '$shown', '$tex', '$tieN', '$k', '$doorN', '$waterN']) delete G[k];
    for (const k of ['doors', 'doorCount', 'waters', 'waterCount', 'waterX', 'waterY', 'waterW', 'waterH', 'waterDamage', 'regionCount', 'textureFollows']) delete G[N[k]];
    G[N.regionCount] = saved.regionCount;
  }
});

test('editor: every parameter the game reads is in the params panel, and every one says how it reaches a running level', async () => {
  const { paramsOf } = await consoleModule('editor/params.js');
  const { KIND_TAGS } = await consoleModule('editor/kinds.js');
  const { liveSupport } = await consoleModule('editor/apply.js');
  // What the map loader reads of each kind (frame2.js: b["#..."] in each kind's branch).
  const GAME_READS = {
    box: 'x y w h m', image: 'id width height', bg: 'x y w h f c u v a m s', pushf: 'x y w h tox toy stab damage uid attach',
    water: 'attach x y w h damage friction', door: 'vis x y w h moving tarx tary maxspeed uid mute attach',
    region: 'x y w h uses_timer use_target use_on uid attach', trigger: 'execute enabled maxcalls uid', timer: 'enabled maxcalls target delay uid',
    barrel: 'model x y tox toy uid', vehicle: 'model x y tox toy uid side hpp', decor: 'model f u v x y r sx sy uid attach text',
    gun: 'model command upg uid x y', song: 'uid url volume loop callback', inf: 'mark forteam x y', lamp: 'x y power flare uid',
    player: 'x y uid hea hmax tox toy ondeath team botaction side incar char', enemy: 'x y uid hea hmax tox toy ondeath team botaction side incar char',
  };
  assert.deepEqual(Object.keys(GAME_READS).sort(), [...KIND_TAGS].sort(), 'every kind the game reads, and no other');
  for (const tag of KIND_TAGS) {
    const shown = paramsOf(tag);
    for (const attr of GAME_READS[tag].split(' ')) assert.ok(shown.includes(attr), `${tag} ${attr}: not in the panel`);
    for (const attr of shown) {
      const how = liveSupport(tag, attr);
      assert.ok(how && how !== 'the running level cannot take it', `${tag} ${attr}: no way into a running level, and no reason`);
    }
  }
});

test('editor: a wall\'s grab points go with it, where there is room beside its corners, as the loader gives them', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const G = game.G, N = game.N;
  const original = G[N.mapText];
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  G.$tagBox = 'box';
  // The loader's loop over the walls: a grab point (veh_hh, made a vehicle of model 6) at
  // each top corner the game's line test finds room beside.
  const frame2 = `
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
}
for(i=0;i<${N.wallCount};i++)
{
$HОpcl=75;
if($clear(${N.wallX}[i]-15,${N.wallY}[i]-30,${N.wallX}[i]-15,${N.wallY}[i]+$HОpcl))
if($clear(${N.wallX}[i]+5,${N.wallY}[i]-5,${N.wallX}[i]+5,${N.wallY}[i]-50))
{
mc=game.addChildAt(new veh_hh,game.numChildren);
n=6;
mc["x"]=parseFloat(${N.wallX}[i]);
mc["y"]=parseFloat(${N.wallY}[i]);
$makeVehicle(mc,n,1);
}
}
`;
  const layer = () => ({ children: [], get numChildren() { return this.children.length; },
    addChildAt(o, at) { this.children.splice(at, 0, o); o.parent = this; return o; }, removeChild(o) { this.children.splice(this.children.indexOf(o), 1); } });
  const saved = { game: G.game, graphics_3d: G.graphics_3d };
  const world = Object.assign(layer(), { x: saved.game.x, y: saved.game.y, scaleX: saved.game.scaleX, scaleY: saved.game.scaleY, parent: saved.game.parent });
  const made = [];
  Object.assign(G, {
    game: world, graphics_3d: layer(), $wallsBuilt: 0, veh_hh: class {},
    // No room at x >= 900 (another wall there).
    $clear: (x1, y1, x2) => x1 < 900 && x2 < 900,
    $makeVehicle: (mc, model, side) => { Object.assign(mc, { model, side, io: true }); made.push(mc); },
    [N.displayInit]: () => {},
    [N.wallX]: [100], [N.wallY]: [100], [N.wallW]: [200], [N.wallH]: [20], [N.wallCount]: 1, [N.wallMaterial]: ['0'],
    [N.gridCell]: 100, [N.gridMinX]: -200, [N.gridMinY]: -200, [N.gridCols]: 14, [N.gridRows]: 6,
  });
  G[N.grid] = Array.from({ length: 14 }, () => Array.from({ length: 6 }, () => []));
  G[N.gridAddWall] = () => {};
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2 }));
  // The level as loaded: both corners of the wall have one.
  const left = Object.assign(world.addChildAt(new G.veh_hh(), 0), { x: 100, y: 100, io: true, side: 1 });
  const right = Object.assign(world.addChildAt(new G.veh_hh(), 1), { x: 300, y: 100, io: true, side: -1 });
  const at = (h) => (h.io ? [h.x, h.y] : 'out');
  try {
    G[N.mapText] = '<box x="100" y="100" w="200" h="20" m="0" />';
    game.run('editor on');
    level(false); level(true);
    session.select(session.editorDoc().byTag('box')[0]);
    // Moved: the same two go along.
    assert.deepEqual(quiet('editor set x 400'), ['wall #0: x = "400", live now']);
    assert.deepEqual([at(left), at(right), made.length], [[400, 100], [600, 100], 0]);
    quiet('editor set y 150');
    assert.deepEqual([at(left), at(right)], [[400, 150], [600, 150]]);
    // Its right corner against another wall: no room, that one is taken out.
    quiet('editor set x 750');
    assert.deepEqual([at(left), at(right)], [[750, 150], 'out']);
    // Room again: a new one, made as the loader makes it.
    quiet('editor set x 400');
    assert.equal(made.length, 1);
    assert.deepEqual([made[0].x, made[0].y, made[0].model, made[0].side], [600, 150, 6, -1]);
    // Deleted: both out of play.
    game.press('Delete');
    assert.deepEqual([at(left), at(made[0])], ['out', 'out']);
    game.run('editor undo');
    // Added: one at each corner with room.
    assert.match(quiet('editor add wall 0 0 100 20')[0], /; in the running level$/);
    assert.deepEqual(made.slice(1).map((h) => [h.x, h.y, h.side]), [[0, 0, 1], [100, 0, -1]]);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    Object.assign(G, saved);
    for (const k of ['$tagBox', '$wallsBuilt', 'veh_hh', '$clear', '$makeVehicle', '$HОpcl']) delete G[k];
  }
});

test('editor reset: every edit undone in the running level and forgotten, nothing put in again', async () => {
  const session = await consoleModule('editor/session.js');
  const { G, N } = game;
  const quiet = (line) => game.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };
  const regions = G[N.regions];
  const count = G[N.regionCount];
  G[N.regionCount] = regions.length;
  try {
    level(true);
    game.run('editor on');
    const doc = session.editorDoc();
    const red = doc.byUid('#red_use');
    const i = red.live.index;
    const y0 = regions[i].y;
    session.select(red);
    quiet('editor set y 30');
    quiet('editor set x 77');
    assert.deepEqual([regions[i].y, regions[i].x], [30, 77]);
    game.run('editor off');
    assert.deepEqual(game.run('list editor'), ['[editor: 1 changed]',
      '  in the running level; put in again when the level starts over on this map', '  ("editor reset" undoes and forgets them)']);
    assert.match(quiet('editor reset')[0], /^Reset: 2 edits undone in the running level, every edit forgotten/);
    assert.equal(regions[i].y, y0, 'the map\'s again');
    assert.deepEqual(game.run('list editor'), ['[editor] nothing']);
    // On again: the map as the game has it, no history, nothing to put in.
    game.run('editor on');
    assert.notEqual(session.editorDoc(), doc);
    assert.equal(session.editorDoc().byUid('#red_use').attrs.y, String(y0));
    assert.equal(quiet('editor undo')[0], 'Nothing to undo');
    // An edit, then the level starts over with the editor off: the level is the map's
    // own, so a reset only forgets it.
    session.select(session.editorDoc().byUid('#red_use'));
    quiet('editor set y 40');
    game.run('editor off');
    regions[i].y = y0; // the game builds the level again from the map
    level(false); level(true);
    assert.deepEqual(quiet('editor reset'), ['Reset: every edit forgotten; nothing is put in again when the level starts over']);
    game.run('editor on');
    assert.equal(regions[i].y, y0, 'not put in again');
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.regionCount] = count;
  }
});
