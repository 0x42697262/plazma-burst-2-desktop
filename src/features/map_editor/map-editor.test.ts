import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole, type FakeGame } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

type Spot = { x: number; y: number };

const textsOf = (node: any): string[] => [node.text, ...(node.childNodes || []).flatMap((child: any) => (typeof child === 'string' ? [child] : textsOf(child)))].filter(Boolean);

let game: FakeGame;
before(async () => { game = await bootConsole({ sayTrigger: '#chat_in' }); });

const runWithoutNotes = (line: string): string[] => game.run(line).filter((printed) => !printed.startsWith('Note:'));
const setLevelRunning = (on: boolean): void => { game.globals.stage.currentFrameLabel = on ? 'gaming' : 'menu'; game.frame(); };

test('editor: on and off by its key, outlines every object, selects by click and from its lists', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { drawEditorFrame } = await import('#features/map_editor/ui/view.ts');
  const { worldOfEvent } = await import('#features/map_editor/ui/input.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  const overlay = globals[names.uiOverlay].overlay;
  try {
    assert.match(game.run('editor')[0], /^Editor on: click an object to select it\. f8 or "editor" turns it off\./);
    assert.ok(session.editorOn());
    const first = drawEditorFrame();
    assert.ok(first && first.outlines > 5, JSON.stringify(first));
    assert.ok(textsOf(overlay).includes('Layers:') && textsOf(overlay).includes('Tools:'));
    const iconSourcesOf = (node: any): string[] => [node.src, ...(node.childNodes || []).flatMap((child: any) => (typeof child === 'string' ? [] : iconSourcesOf(child)))].filter(Boolean);
    assert.ok(iconSourcesOf(overlay).includes('/level_editor/icons16/edit.gif') && iconSourcesOf(overlay).includes('/level_editor/icons16/box.gif'), 'the map editor\'s own icons, from the site');
    const sheet = globals.document.getElementById('pb2dev-editor-style');
    assert.match(sheet.text, /pb2dev-editor-scroll::-webkit-scrollbar \{ width: 1\.75px;/, 'the map editor\'s thin scroll bars come from a stylesheet: inline styles cannot make them');
    assert.match(sheet.text, /-webkit-scrollbar-thumb \{ border-radius: 1\.75px; background-color: #515151;/);
    const classNamesOf = (node: any): string[] => [node.className, ...(node.childNodes || []).flatMap((child: any) => (typeof child === 'string' ? [] : classNamesOf(child)))].filter(Boolean);
    assert.ok(classNamesOf(overlay).filter((className) => className === 'pb2dev-editor-scroll').length >= 3, 'both panels and the object box');
    for (const child of overlay.childNodes) {
      if (child.style) assert.equal(child.style.visibility, 'visible', `the game's CSS hides its overlay container, so everything put in it must show itself; hidden: ${textsOf(child).slice(0, 2).join(' ')}`);
    }
    assert.match(game.press('F8')[0], /^\[key f8\] > editor/);
    assert.ok(!session.editorOn(), 'the key turns it off');
    assert.equal(drawEditorFrame(), null);
    assert.ok(!textsOf(overlay).includes('Layers:'), 'panels gone');
    assert.equal(globals.document.getElementById('pb2dev-editor-style'), null, 'and the stylesheet');
    game.press('F8');
    assert.ok(session.editorOn(), 'and on again');

    globals[names.mapText] = [
      '<box x="0" y="0" w="400" h="200" m="0" />',
      '<box x="100" y="50" w="20" h="20" m="0" />',
      '<trigger uid="#t" x="500" y="0" enabled="true" maxcalls="-1" actions_1_type="100" actions_1_targetA="a" actions_1_targetB="1" />',
      '<timer uid="#clock" x="560" y="0" enabled="true" maxcalls="-1" target="#t" delay="30" />',
    ].join('\n');
    setLevelRunning(false);
    assert.ok(session.editorOn() && !session.editorShown(), 'hidden while no level runs');
    assert.equal(drawEditorFrame(), null);
    setLevelRunning(true);
    assert.ok(session.editorShown(), 'back with the level');
    const doc = session.editorDoc()!;
    assert.equal(doc.elements.length, 4, 'a new map text (a restart, another map) is read again');
    assert.equal(doc.toText(), globals[names.mapText], 'the map text comes back as it was');

    const insideBothWalls = { x: 110, y: 60 };
    assert.equal(doc.ordinal(session.pickAt(insideBothWalls)!), 1, 'the smallest under the click first');
    assert.equal(doc.ordinal(session.pickAt(insideBothWalls)!), 0, 'the same spot again takes the next one');
    assert.equal(doc.ordinal(session.pickAt(insideBothWalls)!), 1, 'and round again');
    assert.equal(session.pickAt({ x: 1000, y: 1000 }), null, 'nothing there: deselect');
    const { currentTransform, toScreen } = await import('#console/kernel/ui/overlay.ts');
    const back = toScreen(currentTransform()!, worldOfEvent({ clientX: 110, clientY: 60 } as any)!);
    assert.ok(Math.abs(back.x - 110) < 1e-9 && Math.abs(back.y - 60) < 1e-9, `screen to world and back: the fake canvas is 800x400 on screen, as wide as the game; ${JSON.stringify(back)}`);

    session.pickAt({ x: 500, y: 0 });
    assert.equal(session.selected()!.attrs.uid, '#t');
    assert.equal(drawEditorFrame()!.links, 1, 'the selection\'s logic links: the timer that runs it');
    assert.equal(session.currentLayer(), 'trigger', 'its layer in the panels');
    const texts = textsOf(overlay);
    assert.ok(texts.includes('Objects (4):') && texts.includes('#t') && texts.includes('1. SetVar') && texts.includes('A (string)'), 'the trigger\'s actions: its params in the panels');
    assert.ok(texts.includes('1 trigger selected: #t'));

    assert.deepEqual(game.press('Escape'), []);
    assert.equal(session.selected(), null, 'Esc clears the selection');
    session.setSelectable(session.LAYER_GROUPS.logics!);
    assert.equal(drawEditorFrame()!.outlines, 4, 'still drawn: as in the map editor, what is not on an active layer is drawn faint');
    assert.equal(session.pickAt(insideBothWalls), null, 'walls are statics, not on an active layer: they cannot be selected');
    assert.ok(textsOf(overlay).includes('Objects (2):'), 'the object box lists the active layers');
    session.pickAt({ x: 500, y: 0 });
    assert.equal(session.selected()!.attrs.uid, '#t');
    session.setSelectable(['box']);
    assert.equal(session.selected(), null, 'a selection off the active layers is let go');
    assert.equal(doc.ordinal(session.pickAt(insideBothWalls)!), 1);
    const { KIND_TAGS } = await import('#features/map_editor/domain/kinds.ts');
    assert.match(game.run('editor layers entities')[0], /^Layers: player, enemy, vehicle, decoration, gun, barrel, engine mark/, 'the same from the console: a group');
    game.run('editor layers wall');
    assert.deepEqual(session.selectableLayers(), ['box'], 'a kind');
    game.run('editor layers +trigger');
    game.run('editor layers -wall');
    assert.deepEqual(session.selectableLayers(), ['trigger'], '+ and -, the map editor\'s Ctrl and Alt');
    assert.match(errorsOf(game.run('editor layers nonsense'))[0], /usage: editor layers/);
    game.run('editor layers all');
    assert.equal(session.selectableLayers().length, KIND_TAGS.length);

    setLevelRunning(false);
    game.run('editor off');
    assert.ok(!session.editorOn(), 'off works without a level');
    assert.match(errorsOf(game.run('editor'))[0], /start a level first/, 'on needs one');
  } finally {
    globals.stage.currentFrameLabel = 'gaming';
    globals[names.mapText] = original;
    session.setEditor(false); session.forgetDocument();
  }
});

test('editor: edits go into the running level, in any mode, and again after a restart; drag moves and resizes', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { mouse, grabOf, dragPlace } = await import('#features/map_editor/ui/input.ts');
  const { currentTransform, toScreen } = await import('#console/kernel/ui/overlay.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  const mouseEventAtWorldPoint = (point: Spot, extra = {}): any => {
    const onScreen = toScreen(currentTransform()!, point);
    return { button: 0, clientX: onScreen.x, clientY: onScreen.y, ...extra };
  };
  try {
    game.run('editor on');
    const doc = session.editorDoc()!;
    const region = doc.byUid('#red_use')!;
    const liveRegionOne = globals[names.regions][1];

    session.select(region);
    assert.deepEqual(runWithoutNotes('editor set x 450'), ['#red_use: x = "450", live now'], 'live in a match (the fake game is one): the editor does not care which mode it is');
    assert.equal(liveRegionOne.x, 450, 'the game\'s region moves at once');
    assert.equal(globals[names.mapText], original, 'the game\'s map text is never written');
    assert.equal(session.editorDoc(), doc, 'the editor keeps its document');
    runWithoutNotes('editor set use_on 12');
    assert.equal(liveRegionOne[names.regionUseOn], 10, 'stored as the loader stores it');
    runWithoutNotes('editor set use_target #locked');
    assert.equal(liveRegionOne[names.regionTrigger], game.triggers.findIndex((trigger) => trigger.uid === '#locked'));

    const onDeath = doc.byUid('#on_death')!;
    session.select(onDeath);
    runWithoutNotes('editor set actions_1_targetB 5');
    const liveTrigger = globals[names.triggers][doc.ordinal(onDeath)!];
    assert.deepEqual(liveTrigger[names.trigTargetB], [5], 'trigger actions are loaded again from the attributes');
    runWithoutNotes('editor set enabled false');
    assert.equal(liveTrigger[names.trigEnabled], false);

    const stone = doc.elements.find((element) => element.tag === 'decor' && !element.attrs.uid);
    session.select(stone!);
    assert.deepEqual(runWithoutNotes('editor set x 720'), ['decoration #1: x = "720", live now']);
    assert.equal(globals[names.decors][1].x, 720, 'a decoration moves at once');
    runWithoutNotes('editor set r 45');
    assert.equal(globals[names.decors][1].rotation, 45);
    session.select(doc.byUid('#sign'));
    assert.match(runWithoutNotes('editor set x 230')[0]!, /not in the running level: /, 'unless a movable carries it, and no game loader to build it again here');

    const door = doc.byUid('#door_a')!;
    session.select(door);
    assert.match(runWithoutNotes('editor set w 60')[0]!, /^#door_a: w = "60", not in the running level: .* \(kept for "editor save"\)/, 'not live: kept for "editor save", and it says why');
    assert.equal(session.pendingCount(), 2);
    assert.match(errorsOf(game.run('editor set x abc'))[0], /x must be a number/);
    assert.match(errorsOf(game.run('editor set c "a"b"'))[0], /cannot contain a double quote/);

    mouse.down(mouseEventAtWorldPoint({ x: 210, y: 50 }));
    mouse.move(mouseEventAtWorldPoint({ x: 233, y: 64 }));
    mouse.up();
    assert.deepEqual([door.attrs.x, door.attrs.y, door.attrs.w], ['220', '10', '60'], 'drag: press on the selection, move, let go; snaps to 10');
    assert.equal(grabOf(door, { x: 220, y: 10, w: 60, h: 100 }, { x: 279, y: 50 }, 3), 'r', 'its right edge resizes');
    assert.equal(grabOf(door, { x: 220, y: 10, w: 60, h: 100 }, { x: 221, y: 11 }, 3), 'lt');
    mouse.down(mouseEventAtWorldPoint({ x: 279, y: 50 }));
    mouse.move(mouseEventAtWorldPoint({ x: 301.5, y: 50 }, { altKey: true }));
    mouse.up();
    assert.deepEqual([door.attrs.x, door.attrs.w], ['220', '82.5'], 'Alt does not snap');
    assert.deepEqual(dragPlace({ x: 0, y: 0, w: 10, h: 10 }, 'l', 30, 0, false), { x: 10, y: 0, w: 20, h: 10 }, 'dragged past the far edge: flips');
    session.select(null);
    mouse.down(mouseEventAtWorldPoint({ x: 240, y: 60 }));
    assert.equal(session.selected(), door, 'an object that is not selected: selected on the press');
    mouse.move(mouseEventAtWorldPoint({ x: 260, y: 60 }));
    mouse.up();
    assert.equal(door.attrs.x, '240', 'and moved by the same press');
    mouse.down(mouseEventAtWorldPoint({ x: 250, y: 60 }));
    mouse.up();
    assert.equal(session.selected(), door, 'a click on the selection with nothing below it keeps it');
    runWithoutNotes('editor undo');
    mouse.down(mouseEventAtWorldPoint({ x: 400 + 50, y: 10 }));
    mouse.up();
    assert.equal(session.selected(), region, 'a click without moving selects what is under it instead');

    const gameBuildsRegionFromItsMapText = () => {
      liveRegionOne.x = 400;
      liveRegionOne[names.regionUseOn] = 9;
    };
    gameBuildsRegionFromItsMapText();
    globals.stage.currentFrameLabel = 'loading'; game.frame();
    globals.stage.currentFrameLabel = 'gaming'; game.frame();
    assert.equal(session.editorDoc(), doc, 'the level starts again on the same map (dying, a new round): same document');
    assert.equal(liveRegionOne.x, 450, 'the game builds it without the edits, and the editor puts them in again');
    assert.equal(liveRegionOne[names.regionUseOn], 10);
    assert.equal(globals[names.decors][1].rotation, 45);
    assert.equal(globals[names.mapText], original);
    assert.equal(game.run('editor reload')[0].startsWith('error: '), true, 'no reload command');

    game.log.printed.length = 0;
    globals.pb2dev.run('editor save my map');
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(game.log.printed.some((line) => /could not save \(no desktop wrapper in tests\)/.test(line)), `save goes to the desktop wrapper: ${game.log.printed.join(' | ')}`);
    assert.match(errorsOf(game.run('editor save'))[0], /usage: editor save <name>/);
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
  }
});

test('editor tools: place, copy, delete and undo; live edits still reach the right game object', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { mouse } = await import('#features/map_editor/ui/input.ts');
  const { currentTransform, toScreen } = await import('#console/kernel/ui/overlay.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  const mouseEventAtWorldPoint = (point: Spot, extra = {}): any => {
    const onScreen = toScreen(currentTransform()!, point);
    return { button: 0, clientX: onScreen.x, clientY: onScreen.y, ...extra };
  };
  try {
    game.run('editor on');
    const doc = session.editorDoc()!;
    const walls = () => doc.byTag('box').length;
    const wallsBefore = walls();

    const canvas = globals.game_canvas;
    const pointerAtWorldPoint = (point: Spot) => {
      const onScreen = toScreen(currentTransform()!, point);
      return { clientX: onScreen.x, clientY: onScreen.y };
    };
    let pressesThatReachedTheGame = 0;
    const gameGraphicsLibraryListener = () => { pressesThatReachedTheGame++; };
    canvas.addEventListener('pointerdown', gameGraphicsLibraryListener);
    globals.onpointerdown = () => { pressesThatReachedTheGame++; };
    const down: any = game.dispatch(canvas, 'pointerdown', pointerAtWorldPoint({ x: 215, y: 50 }));
    game.dispatch(canvas, 'pointerup', pointerAtWorldPoint({ x: 215, y: 50 }));
    assert.equal(session.selected(), doc.byUid('#door_a'), 'a real click, as pointer events on the game canvas, selects');
    assert.ok(down.defaultPrevented && pressesThatReachedTheGame === 0, 'the editor hears them first and keeps them from the game, whose own pointerdown listener (its graphics library) would cancel them so no mouse event follows');
    delete globals.onpointerdown;
    const panel = globals[names.uiOverlay].overlay.childNodes.find((child: any) => child.pb2devUi);
    game.dispatch(panel, 'pointerdown', pointerAtWorldPoint({ x: 215, y: 50 }));
    game.dispatch(panel, 'pointerup', pointerAtWorldPoint({ x: 215, y: 50 }));
    assert.equal(session.selected(), doc.byUid('#door_a'), 'unchanged: a press on the editor\'s own panels is theirs, not a click in the world');
    assert.match(game.run('editor status').join('\n'), /last press the window saw: .* left alone/);
    session.select(null);

    runWithoutNotes('editor tool place wall');
    mouse.down(mouseEventAtWorldPoint({ x: 1003, y: 498 }));
    mouse.move(mouseEventAtWorldPoint({ x: 1150, y: 560 }));
    assert.deepEqual(session.placePreview(), { tag: 'box', x: 1000, y: 500, w: 150, h: 60 }, 'place tool: drag out a wall, snapped');
    mouse.up();
    assert.equal(walls(), wallsBefore + 1);
    const wall = session.selected()!;
    assert.deepEqual(wall.attrs, { x: '1000', y: '500', w: '150', h: '60', m: '0' });
    assert.equal(session.placePreview(), null);
    mouse.down(mouseEventAtWorldPoint({ x: 2000, y: 0 }));
    mouse.up();
    assert.deepEqual([session.selected()!.attrs.w, session.selected()!.attrs.h], ['100', '100'], 'a click places a default-sized one');
    assert.match(doc.toText(), /<box x="2000" y="0" w="100" h="100" m="0" \/>/, 'in the map, for "editor save"');
    assert.deepEqual(game.press('Escape'), []);
    assert.equal(session.currentTool(), 'select', 'Esc: back to select');
    game.press('F8'); game.press('F8');
    assert.equal(session.editorDoc(), doc, 'F8 off and on again: the same document');
    assert.equal(walls(), wallsBefore + 2, 'the placed walls are still there');
    assert.equal(session.pickAt({ x: 2050, y: 50 })?.attrs.x, '2000', 'and can be selected');

    assert.match(runWithoutNotes('editor add region 100 200 50 50')[0]!, /^Added #region\*1 at 100, 200 \(50 x 50\)/, 'add by command, with a uid numbered like the map editor\'s');
    game.press('KeyD', { ctrlKey: true });
    assert.equal(session.selected()!.attrs.uid, '#region*2', 'a copy gets the next one');
    assert.deepEqual([session.selected()!.attrs.x, session.selected()!.attrs.y], ['120', '220']);

    const buttonIsRegionZero = doc.byUid('#button');
    session.select(buttonIsRegionZero);
    game.press('Delete');
    assert.equal(doc.byUid('#button'), null);
    const redUse = doc.byUid('#red_use')!;
    assert.equal(doc.ordinal(redUse), 0, 'first region of the map now');
    session.select(redUse);
    runWithoutNotes('editor set y 30');
    assert.equal(globals[names.regions][1].y, 30, 'still the game\'s region #1: deleting a region does not shift the others in the game, which still has it');
    assert.deepEqual([globals[names.regions][0].x, globals[names.regions][0][names.regionUseOn]], [1e7, 0], 'the deleted one out of play, the others where they were');
    session.select(doc.byUid('#region*1'));
    assert.match(runWithoutNotes('editor set x 150')[0]!, /not in the running level: it is not in the running level yet/, 'new elements are not in the game: never live');

    session.select(wall);
    mouse.down(mouseEventAtWorldPoint({ x: 1075, y: 530 }));
    mouse.move(mouseEventAtWorldPoint({ x: 1100, y: 530 }));
    mouse.move(mouseEventAtWorldPoint({ x: 1125, y: 530 }));
    mouse.up();
    assert.equal(wall.attrs.x, '1050');
    game.press('KeyZ', { ctrlKey: true });
    assert.equal(wall.attrs.x, '1000', 'undo: one step per action; the whole drag at once');
    game.press('KeyY', { ctrlKey: true });
    assert.equal(wall.attrs.x, '1050');
    for (const _undoneStep of ['the drag', 'x 150 of #region*1', 'y 30']) runWithoutNotes('editor undo');
    assert.equal(globals[names.regions][1].y, 0, 'undo goes live too');
    runWithoutNotes('editor undo');
    assert.equal(doc.ordinal(doc.byUid('#button')!), 0, 'the delete undone: back where it was');
    assert.equal(session.selected(), doc.byUid('#button'));
    while (session.editorDoc()!.byTag('box').length > wallsBefore) runWithoutNotes('editor undo');
    assert.equal(doc.byUid('#region*1'), null);
    assert.equal(game.run('editor undo')[0], 'Nothing to undo');
    assert.equal(doc.toText(), original, 'the map as it was');

    assert.match(errorsOf(game.run('editor add nonsense'))[0], /usage: editor add <kind>/);
    session.select(null);
    assert.match(errorsOf(game.run('editor delete'))[0], /select an object first/);
  } finally {
    session.setTool('select');
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
  }
});

test('editor: walls (with trims), backgrounds, water, pushers and movables move in the running level', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  const levelAsTheGameHoldsItAfterLoading = [
    '<box x="0" y="0" w="200" h="20" m="0" />',
    '<box x="300" y="0" w="100" h="40" m="0" />',
    '<bg x="0" y="100" w="50" h="50" m="0" />',
    '<water uid="#pool" x="600" y="0" w="100" h="50" damage="0" friction="true" />',
    '<pushf uid="#fan" x="800" y="0" w="40" h="40" tox="0" toy="-1" stab="0" damage="0" attach="-1" />',
    '<door uid="#lift" x="500" y="0" w="40" h="10" moving="false" tarx="500" tary="-100" maxspeed="10" vis="true" attach="-1" />',
  ];
  globals[names.mapText] = levelAsTheGameHoldsItAfterLoading.join('\n');
  globals[names.wallX] = [0, 300]; globals[names.wallY] = [0, 0]; globals[names.wallW] = [200, 100]; globals[names.wallH] = [20, 40]; globals[names.wallCount] = 2;
  const loaderGridCellSize = 100;
  const loaderGridStartLeftOfAndAboveTheWalls = -200;
  Object.assign(globals, { [names.gridCell]: loaderGridCellSize, [names.gridMinX]: loaderGridStartLeftOfAndAboveTheWalls, [names.gridMinY]: loaderGridStartLeftOfAndAboveTheWalls, [names.gridCols]: 12, [names.gridRows]: 6 });
  globals[names.grid] = Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => []));
  globals[names.gridAddWall] = (index: number) => {
    const firstColumn = Math.floor((globals[names.wallX][index] - 100 + 200) / 100), lastColumn = Math.ceil((globals[names.wallX][index] + globals[names.wallW][index] + 100 + 200) / 100);
    const firstRow = Math.floor((globals[names.wallY][index] - 100 + 200) / 100), lastRow = Math.ceil((globals[names.wallY][index] + globals[names.wallH][index] + 100 + 200) / 100);
    for (let column = firstColumn; column <= lastColumn; column++) for (let row = firstRow; row <= lastRow; row++) globals[names.grid][column][row].push(index);
  };
  globals[names.gridAddWall](0); globals[names.gridAddWall](1);
  globals.texture_front0 = class {};
  const wallOneBody = Object.assign(new globals.texture_front0(), { x: 300, y: 0, scaleX: 1, scaleY: 0.4 });
  const bitmapFill = (textureY: number, textureX = 0) => ['beginBitmapFill', [{}, { tx: textureX, ty: textureY }, true, true]];
  const filledQuad = (left: number, top: number, right: number, bottom: number) => [['moveTo', [left, top]], ['lineTo', [right, top]], ['lineTo', [right, bottom]], ['lineTo', [left, bottom]], ['endFill', []]];
  const wallOneTopTrimHeight = 16;
  const wallOneBottomTrimTop = 40 - wallOneTopTrimHeight;
  const backgroundRectangle = [bitmapFill(100), ...filledQuad(0, 100, 50, 150)];
  const wallOneTopTrim = [bitmapFill(0), ...filledQuad(300, 0, 400, wallOneTopTrimHeight)];
  const wallOneBottomTrim = [bitmapFill(wallOneBottomTrimTop), ...filledQuad(300, wallOneBottomTrimTop, 400, 40)];
  const wallZeroTopTrimNotWallOnes = [bitmapFill(0), ...filledQuad(0, 0, 200, 16)];
  let scheduled = 0;
  const spriteSharedByBackgroundAndTrims = { graphics: { bounds: { x1: 0, y1: 0, x2: 0, y2: 0 }, ScheduleBitmapUpdate() { scheduled++; }, draw_operations: [
    ...backgroundRectangle, ...wallOneTopTrim, ...wallOneBottomTrim, ...wallZeroTopTrimNotWallOnes,
  ] } };
  globals.graphics_3d = { children: [wallOneBody, spriteSharedByBackgroundAndTrims] };
  const pool = { x: 600, y: 0, scaleX: 1, scaleY: 0.5 };
  globals[names.waters] = [pool]; globals[names.waterCount] = 1;
  globals[names.waterX] = [590]; globals[names.waterY] = [0]; globals[names.waterW] = [120]; globals[names.waterH] = [60]; globals[names.waterDamage] = [0];
  globals[names.bgX] = [0]; globals[names.bgY] = [100]; globals[names.bgW] = [50]; globals[names.bgH] = [50]; globals[names.bgCount] = 1;
  Object.assign(globals, { [names.pushX1]: [800], [names.pushY1]: [0], [names.pushX2]: [840], [names.pushY2]: [40], [names.pushCount]: 1,
    [names.pushToX]: [0], [names.pushToY]: [-1], [names.pushStab]: [0], [names.pushDamage]: [0] });
  const lift = { x: 500, y: 0, w: 40, h: 10, scaleX: 0.4, scaleY: 0.1, tarx: 500, tary: -100 };
  globals[names.doors] = [lift]; globals[names.doorCount] = 1;
  const cellsOfWall = (grid: any[][][], index: number) => grid.flatMap((column, columnIndex) => column.map((cell, rowIndex) => (cell.includes(index) ? `${columnIndex},${rowIndex}` : null))).filter(Boolean);
  const cellsTheGamesOwnFunctionGives = (index: number) => {
    const real = globals[names.grid];
    globals[names.grid] = real.map((column: any[]) => column.map(() => []));
    globals[names.gridAddWall](index);
    const want = cellsOfWall(globals[names.grid], index);
    globals[names.grid] = real;
    return want;
  };
  const drawOperations = (): any[] => spriteSharedByBackgroundAndTrims.graphics.draw_operations;
  const pointsFrom = (from: number, count = 4) => drawOperations().slice(from, from + count).map((operation) => operation[1].slice(0, 2));
  try {
    game.run('editor on');
    setLevelRunning(false); setLevelRunning(true);
    const doc = session.editorDoc()!;

    const wall = doc.byTag('box')[1]!;
    session.select(wall);
    assert.deepEqual(runWithoutNotes('editor set h 60'), ['wall #1: h = "60", live now'], 'a wall, in a match: arrays, grid, body, trims');
    assert.equal(globals[names.wallH][1], 60);
    assert.equal(wallOneBody.scaleY, 0.6);
    assert.deepEqual(pointsFrom(7), [[300, 0], [400, 0], [400, 16], [300, 16]], 'its height: the top trim stays');
    assert.deepEqual(pointsFrom(13), [[300, 44], [400, 44], [400, 60], [300, 60]], 'the bottom trim follows the bottom edge, down 20');
    assert.equal(drawOperations()[12][1][1].ty, 44, 'its texture with it');
    runWithoutNotes('editor set x 350');
    assert.deepEqual([globals[names.wallX][1], wallOneBody.x], [350, 350], 'moved: everything of it goes along');
    assert.deepEqual(pointsFrom(7)[0], [350, 0]);
    assert.deepEqual(pointsFrom(13)[0], [350, 44]);
    assert.deepEqual(pointsFrom(19)[0], [0, 0], 'the other wall\'s trim untouched');
    assert.deepEqual(cellsOfWall(globals[names.grid], 1), cellsTheGamesOwnFunctionGives(1), 'in exactly the cells the game lists it in');
    assert.deepEqual(cellsOfWall(globals[names.grid], 0), cellsTheGamesOwnFunctionGives(0), 'the other wall untouched');
    runWithoutNotes('editor set w 200');
    assert.deepEqual(pointsFrom(7), [[350, 0], [550, 0], [550, 16], [350, 16]], 'wider: trims stretch with it');
    assert.ok(scheduled > 0, 'the layer is redrawn');
    assert.match(runWithoutNotes('editor set x 5000')[0]!, /not in the running level: that is outside the area the level's walls were built for/);
    assert.equal(globals[names.wallX][1], 350);
    runWithoutNotes('editor undo');

    session.select(doc.byTag('bg')[0]!);
    assert.deepEqual(runWithoutNotes('editor set y 120'), ['background #0: y = "120", live now']);
    assert.deepEqual(pointsFrom(1), [[0, 120], [50, 120], [50, 170], [0, 170]], 'a background: its drawn rectangle');
    assert.equal(globals[names.bgY][0], 120, 'and its arrays');

    session.select(doc.byUid('#pool'));
    runWithoutNotes('editor set w 200');
    assert.deepEqual([pool.scaleX, globals[names.waterX][0], globals[names.waterW][0], globals[names.waterH][0]], [2, 590, 220, 60], 'water: shown at the map\'s place, acting on a wider area, as the loader does (its damage builds it again as acid: tested with a loader that has water)');

    session.select(doc.byUid('#fan'));
    runWithoutNotes('editor set x 820');
    assert.deepEqual([globals[names.pushX1][0], globals[names.pushX2][0]], [820, 860], 'a pusher: its corners');
    runWithoutNotes('editor set toy -3');
    assert.equal(globals[names.pushToY][0], -3, 'and its push');

    session.select(doc.byUid('#lift'));
    runWithoutNotes('editor set w 80');
    runWithoutNotes('editor set tary -200');
    assert.deepEqual([lift.w, lift.scaleX, lift.tary], [80, 0.8, -200], 'a movable: place, size and destination');

    globals.graphics_3d.numChildren = globals.graphics_3d.children.length;
    globals.graphics_3d.addChildAt = function addChildAt(child: any) { this.children.push(child); child.parent = this; return child; };
    globals.graphics_3d.removeChild = function removeChild(child: any) { this.children.splice(this.children.indexOf(child), 1); };
    globals[names.displayInit] = (shown: any) => { shown.mouseEnabled = false; };
    globals[names.wallMaterial] = ['0', '0'];
    game.run('editor add wall 100 100 50 20');
    const newWall = session.selected()!;
    assert.equal(newWall.live!.index, 2);
    assert.deepEqual([globals[names.wallCount], globals[names.wallX][2], globals[names.wallW][2]], [3, 100, 50], 'a new wall: its arrays');
    assert.deepEqual(cellsOfWall(globals[names.grid], 2), cellsTheGamesOwnFunctionGives(2), 'in the grid');
    const newBody = globals.graphics_3d.children.at(-1);
    assert.deepEqual([newBody.x, newBody.scaleX, newBody.mouseEnabled], [100, 0.5, false], 'a body, as the loader makes one');
    game.press('Delete');
    assert.deepEqual(cellsOfWall(globals[names.grid], 2), [], 'deleted: out of the grid');
    assert.equal(globals[names.wallW][2], 0, 'no size');
    assert.ok(!globals.graphics_3d.children.includes(newBody), 'its body gone');
    game.run('editor undo'); game.run('editor undo');

    const gameRebuildsTheLevelWithoutTheEdits = () => {
      globals[names.wallX] = [0, 300]; globals[names.wallW] = [200, 100]; globals[names.wallH] = [20, 40];
      globals[names.grid] = Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => []));
      globals[names.gridAddWall](0); globals[names.gridAddWall](1);
      Object.assign(wallOneBody, { x: 300, scaleX: 1, scaleY: 0.4 });
      lift.w = 40; globals[names.pushToY][0] = -1;
    };
    gameRebuildsTheLevelWithoutTheEdits();
    setLevelRunning(false); setLevelRunning(true);
    assert.deepEqual([globals[names.wallX][1], globals[names.wallW][1], globals[names.wallH][1], wallOneBody.x], [350, 200, 60, 350], 'the level starts again on the same map: the editor puts the wall in again');
    assert.deepEqual(cellsOfWall(globals[names.grid], 1), cellsTheGamesOwnFunctionGives(1));
    assert.deepEqual([lift.w, globals[names.pushToY][0]], [80, -3]);
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
    for (const key of ['doors', 'doorCount', 'wallCount', 'waters', 'waterCount', 'bgCount', 'pushCount']) delete globals[names[key]];
    delete globals.graphics_3d;
  }
});

test('editor: a trigger\'s actions are added, changed and removed, or edited as the map editor\'s text', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { actionsOf, actionValues, triggerText, valuesFromText } = await import('#features/map_editor/domain/actions.ts');
  const { setAttrs, undo } = await import('#features/map_editor/services/edit.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  try {
    game.run('editor on');
    globals[names.mapText] = '<trigger uid="#t" x="0" y="0" enabled="true" maxcalls="1" actions_1_type="100" actions_1_targetA="a" actions_1_targetB="1" actions_2_type="-1" actions_2_targetA="" actions_2_targetB="" actions_3_type="26" actions_3_targetA="#clock" actions_3_targetB="0" />';
    setLevelRunning(false); setLevelRunning(true);
    const trigger = session.editorDoc()!.byUid('#t')!;
    assert.deepEqual(actionsOf(trigger.attrs), [{ type: '100', A: 'a', B: '1' }, { type: '26', A: '#clock', B: '0' }], 'empty slots (type -1) are not actions');
    assert.equal(triggerText(trigger.attrs), 'uid: #t\nenabled: true\nmaxcalls: 1\n\nSetVar( "a", "1" );\nTimerDisable( "#clock", "0" );', 'the text view, as the map editor writes it');
    setAttrs(trigger, actionValues(trigger.attrs, [...actionsOf(trigger.attrs), { type: 0, A: '#door', B: '#spot' }]));
    assert.deepEqual([trigger.attrs.actions_2_type, trigger.attrs.actions_3_type, trigger.attrs.actions_3_targetB], ['26', '0', '#spot'], 'one added: renumbered from 1');
    assert.ok(!trigger.attrs.actions_4_type, 'the empty slot gone');
    undo();
    assert.equal(trigger.attrs.actions_2_type, '-1', 'one undo step puts the slots back as they were');
    setAttrs(trigger, valuesFromText(trigger.attrs, 'uid: #t\nenabled: false\nmaxcalls: -1\n\nMovableTo( "#door", "#spot" );'));
    assert.deepEqual([trigger.attrs.enabled, trigger.attrs.maxcalls, trigger.attrs.actions_1_type, trigger.attrs.actions_1_targetA], ['false', '-1', '0', '#door'], 'edited as text and applied: headers and actions replaced');
    assert.ok(!('actions_2_type' in trigger.attrs) && !('actions_3_type' in trigger.attrs));
    assert.throws(() => valuesFromText(trigger.attrs, 'Nope( "a", "b" );'), /unknown action "Nope"/);
    const { setTriggersAsText } = await import('#features/map_editor/ui/trigger-panel.ts');
    setTriggersAsText(true);
    session.select(null); session.select(trigger);
    const texts = textsOf(globals[names.uiOverlay].overlay);
    assert.ok(texts.includes('Edit triggers as text:') && texts.includes('Apply') && texts.includes('Edit triggers as param list'), 'the params panel in text mode: the text view and its Apply');
    setTriggersAsText(false);
    setAttrs(trigger, valuesFromText(trigger.attrs, 'uid: #t'));
    assert.deepEqual(actionsOf(trigger.attrs), [], 'a trigger with no actions at all is fine too');
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
  }
});

test('editor: Params shows every parameter of the kind, with the editor\'s titles, defaults and values', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  try {
    game.run('editor on');
    const regionOfAnOldMapWithNoUidUseTargetOrAttach = '<region x="0" y="0" w="10" h="10" use_on="1" />';
    globals[names.mapText] = regionOfAnOldMapWithNoUidUseTargetOrAttach;
    setLevelRunning(false); setLevelRunning(true);
    session.select(session.editorDoc()!.byTag('region')[0]!);
    const texts = textsOf(globals[names.uiOverlay].overlay);
    for (const text of ['ID', 'X', 'Activation Trigger', 'Activation on', 'attach', "1 (''USE'' key (with button))", '-1']) {
      assert.ok(texts.includes(text), `${text}: ${texts.slice(-30).join(' | ')}`);
    }
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
  }
});

test('editor: an object parameter is picked by clicking the object in the world, as in the map editor', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { drawEditorFrame } = await import('#features/map_editor/ui/view.ts');
  const { currentTransform, toScreen } = await import('#console/kernel/ui/overlay.ts');
  const { globals, names } = game;
  const overlay = globals[names.uiOverlay].overlay;
  const nodeWithOwnText = (node: any, text: string): any => {
    if (node.text === text) return node;
    for (const child of node.childNodes || []) {
      const hit = typeof child === 'object' && nodeWithOwnText(child, text);
      if (hit) return hit;
    }
    return null;
  };
  const valueCellOfParamsRow = (label: string) => nodeWithOwnText(overlay, label).parent.childNodes[1];
  const pointerAtWorldPoint = (point: Spot) => {
    const onScreen = toScreen(currentTransform()!, point);
    return { clientX: onScreen.x, clientY: onScreen.y };
  };
  const clickWorldPoint = (point: Spot) => {
    game.dispatch(globals.game_canvas, 'pointerdown', pointerAtWorldPoint(point));
    game.dispatch(globals.game_canvas, 'pointerup', pointerAtWorldPoint(point));
  };
  try {
    game.run('editor on');
    const doc = session.editorDoc()!;
    const region = doc.byUid('#red_use')!;
    session.select(region);
    game.dispatch(valueCellOfParamsRow('Activation Trigger'), 'click', {});
    assert.deepEqual(session.currentPick()!.kinds, ['trigger']);
    assert.ok(drawEditorFrame()!.picks > 0, 'every trigger is marked');
    assert.match(textsOf(overlay).join('\n'), /use_target: click a trigger in the world {2}· {2}Esc: cancel/);
    const lockedTriggerSpot = { x: 120, y: 0 };
    clickWorldPoint(lockedTriggerSpot);
    assert.equal(region.attrs.use_target, '#locked');
    assert.equal(globals[names.regions][1][names.regionTrigger], game.triggers.findIndex((trigger) => trigger.uid === '#locked'), 'live');
    assert.equal(session.currentPick(), null, 'done');
    assert.equal(session.selected(), region, 'the region stays selected');
    game.dispatch(valueCellOfParamsRow('Activation Trigger'), 'click', {});
    assert.ok(session.currentPick());
    game.press('Escape');
    assert.equal(session.currentPick(), null, 'Esc cancels one');
    assert.equal(session.selected(), region, 'Esc ends the pick, not the selection');
    const trigger = doc.byUid('#open_door')!;
    session.select(trigger);
    game.dispatch(valueCellOfParamsRow('B (region)'), 'click', {});
    assert.deepEqual(session.currentPick()!.kinds, ['region'], 'a trigger action\'s target: B of MovableTo is a region');
    const openDoorTriggerSpotNotARegion = { x: 50, y: 0 };
    clickWorldPoint(openDoorTriggerSpotNotARegion);
    assert.ok(session.currentPick(), 'only the kinds it takes');
    const insideSpawnSpotRegion = { x: 490, y: 10 };
    clickWorldPoint(insideSpawnSpotRegion);
    assert.equal(trigger.attrs.actions_2_targetB, '#spawn_spot');
    game.dispatch(valueCellOfParamsRow('A (door)'), 'click', {});
    const onScreenWithNothingThere = { x: 330, y: 150 };
    clickWorldPoint(onScreenWithNothingThere);
    assert.ok(session.currentPick(), 'a pick with nothing there keeps waiting');
    game.press('Escape');
    game.run('editor undo'); game.run('editor undo');
  } finally {
    session.setEditor(false); session.forgetDocument();
  }
});

test('editor: the selection\'s connections are dashed lines as in the map editor: green out, white in', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { drawEditorFrame } = await import('#features/map_editor/ui/view.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  const strokeOfEachLineDrawn = () => {
    const out: { color: unknown; dash: boolean }[] = [];
    let color = null;
    let dash: unknown[] = [];
    for (const call of game.log.drawn) {
      if (call[0] === 'set' && call[1] === 'strokeStyle') color = call[2];
      if (call[0] === 'setLineDash') dash = call[1];
      if (call[0] === 'lineTo') out.push({ color, dash: dash.length > 0 });
    }
    return out;
  };
  try {
    game.run('editor on');
    globals[names.mapText] = [
      '<trigger uid="#t" x="0" y="0" enabled="true" maxcalls="1" actions_1_type="26" actions_1_targetA="#clock" actions_1_targetB="0" />',
      '<timer uid="#clock" x="100" y="0" enabled="true" maxcalls="-1" target="#t" delay="30" />',
    ].join('\n');
    setLevelRunning(false); setLevelRunning(true);
    session.select(session.editorDoc()!.byUid('#t'));
    game.log.drawn.length = 0;
    assert.equal(drawEditorFrame()!.links, 2, 'it disables the timer; the timer runs it');
    const lines = strokeOfEachLineDrawn();
    assert.ok(lines.some((line) => line.color === '#66ff66' && line.dash), 'green, dashed: what it points at');
    assert.ok(lines.some((line) => line.color === '#ffffff' && line.dash), 'white, dashed: what points at it');
    assert.ok(!game.log.drawn.some((call) => call[0] === 'closePath'), 'no arrowheads');
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
  }
});

test('editor: an edit nothing finer takes rebuilds the object with the game\'s own loader code', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const loader = await import('#features/map_editor/services/loader.ts');
  const { globals, names } = game;
  globals.$tagBox = 'box'; globals.$tagRegion = 'region'; globals.$tagDecor = 'decor';
  const frame2WithTagsThroughItsStringTableABuildLoopWithACounterPerKindAndAUidLoop = `
var a,b,c;
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
if(a==$tagRegion)
{
${names.regions}[$regionN]=new Object();
${names.regions}[$regionN]["x"]=parseFloat(b["#x"]);
${names.regions}[$regionN]["y"]=parseFloat(b["#y"]);
${names.regions}[$regionN].w=parseFloat(b["#w"]);
${names.regions}[$regionN].h=parseFloat(b["#h"]);
${names.regions}[$regionN].${names.regionTrigger}=b["#use_target"];
${names.regions}[$regionN].${names.regionUseOn}=parseInt(b["#use_on"]);
if(${names.regions}[$regionN].${names.regionUseOn}==1)
{
mc={ kind: "switch", parent: { removeChild(x) { x.gone = true; } } };
${names.regions}[$regionN].mc=mc;
}
$regionN++;
}
}
for(var $el of $doc.children())
{
if(a==$tagRegion)
{
${names.regions}[$regionR].${names.regionTrigger}="resolved " + ${names.regions}[$regionR].${names.regionTrigger};
$regionR++;
}
}
`;
  const regions = globals[names.regions];
  globals.$regionN = regions.length; globals.$regionR = regions.length; globals.$wallsBuilt = 0;
  globals.a = 'the game\'s a'; globals.mc = 'the game\'s mc';
  await loader.readLoader(async (url: string) => ({ ok: url === 'scripts/frame2.js', status: 200, text: async () => frame2WithTagsThroughItsStringTableABuildLoopWithACounterPerKindAndAUidLoop }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  assert.ok(loader.canRebuild('region') && !loader.canRebuild('gun'));
  try {
    game.run('editor on');
    const doc = session.editorDoc()!;
    const clockSwitchRegionTwoOfFourAUseKey = doc.byUid('#clock_switch');
    session.select(clockSwitchRegionTwoOfFourAUseKey);
    game.run('editor set use_on 0');
    const regionBefore = regions[2];
    assert.deepEqual(runWithoutNotes('editor set use_on 1'), ['#clock_switch: use_on = "1", live now'], 'from switch to none, which nothing finer can take, and then activation 0 -> 1: the game\'s region branch draws a USE switch');
    assert.notEqual(regions[2], regionBefore, 'a new region object from the game\'s code');
    assert.equal(regions[2].mc.kind, 'switch');
    assert.equal(regions[2].x, 440);
    assert.equal(regions[2][names.regionTrigger], 'resolved #timer*2', 'the second loop ran too');
    assert.deepEqual([globals.$regionN, globals.$regionR], [regions.length, regions.length], 'counters as they were');
    assert.deepEqual([globals.a, globals.mc], ['the game\'s a', 'the game\'s mc'], 'its scratch globals as they were');
    const oldSwitch = regions[2].mc;
    game.run('editor set use_on 0');
    assert.ok(oldSwitch.gone, 'and back: the old switch comes off the screen');
    assert.equal(regions[2].mc, undefined);

    const regionCount = regions.length;
    game.run('editor add region 600 0 40 40');
    const added = session.selected()!;
    assert.equal(added.live!.index, regionCount, 'adding one: the game\'s branch at the end of the regions');
    assert.equal(regions.length, regionCount + 1);
    assert.deepEqual([regions[regionCount].x, regions[regionCount].w, globals.$regionN, globals.$regionR], [600, 40, regionCount + 1, regionCount + 1], 'its counters moved on');
    assert.equal(session.pendingCount(), 0, 'in the running level');
    game.press('Delete');
    assert.deepEqual([regions[regionCount].x, regions.length], [1e7, regionCount + 1], 'deleting it: out of play, the others where they were');
    game.run('editor undo');
    assert.equal(regions[regionCount].x, 600, 'undo builds it again in its place');
    assert.equal(regions.length, regionCount + 1);
    const gameBuildsItsRegionsFromTheMap = () => {
      regions.length = regionCount; globals.$regionN = regionCount; globals.$regionR = regionCount;
      globals.stage.currentFrameLabel = 'menu'; game.frame();
      globals.stage.currentFrameLabel = 'gaming'; game.frame();
    };
    gameBuildsItsRegionsFromTheMap();
    assert.deepEqual([regions.length, regions[regionCount].x], [regionCount + 1, 600], 'the level starts over on the same map, without the added one: the editor adds it again');
    session.select(doc.byUid('#spawn_spot'));
    game.press('Delete');
    const spawnSpotXAsTheMapHasIt = 480;
    regions[3].x = spawnSpotXAsTheMapHasIt;
    gameBuildsItsRegionsFromTheMap();
    assert.equal(regions[3].x, 1e7, 'a deleted map region is taken out again after a restart too: still out of play');
    assert.equal(regions[regionCount].x, 600, 'and the added one added again');
    game.run('editor undo');
    game.run('editor undo');
    assert.equal(regions[regionCount].x, 1e7, 'the add undone');
  } finally {
    session.setEditor(false); session.forgetDocument();
    for (const key of ['$tagBox', '$tagRegion', '$tagDecor', '$regionN', '$regionR', '$wallsBuilt']) delete globals[key];
  }
});

test('editor: a map gun moves, changes model, is deleted and comes back in the running level', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  const pointX = globals[names.ptX], pointY = globals[names.ptY], previousX = globals[names.ptPrevX], previousY = globals[names.ptPrevY];
  pointX[20] = 100; pointY[20] = 30; pointX[21] = 110; pointY[21] = 30; previousX[20] = 100; previousY[20] = 30; previousX[21] = 110; previousY[21] = 30;
  const rifleLyingOnTheMapFallenALittleWithItsTwoPhysicsPoints = { model: 'gun_rifle', x: 100, y: 30, picken_by: -1, [names.gunPtA]: 20, [names.gunPtB]: 21 };
  const rifleACharacterHolds = { model: 'gun_rifle', x: 101, y: 0, picken_by: 0 };
  const rifle: any = rifleLyingOnTheMapFallenALittleWithItsTwoPhysicsPoints;
  globals[names.guns] = [rifleACharacterHolds, rifle];
  const made: any[] = [];
  const factory = globals[names.gunFactory];
  globals[names.gunFactory] = (model: string, params: any) => {
    const madeGun = { model, x: params.x, y: params.y, upg: params.upg, picken_by: -1 };
    made.push(madeGun); globals[names.guns].push(madeGun);
    return madeGun;
  };
  try {
    globals[names.mapText] = '<gun uid="#rifle" x="100" y="0" model="gun_rifle" command="-1" upg="0" />';
    game.run('editor on');
    setLevelRunning(false); setLevelRunning(true);
    const gun = session.editorDoc()!.byUid('#rifle');
    session.select(gun);
    assert.deepEqual(runWithoutNotes('editor set x 300'), ['#rifle: x = "300", live now']);
    assert.deepEqual([rifle.x, pointX[20], pointX[21], previousX[20]], [300, 300, 310, 300], 'moved: its points go along');
    assert.equal(rifleACharacterHolds.x, 101, 'the held one is not touched');
    assert.deepEqual(runWithoutNotes('editor set model gun_sniper'), ['#rifle: model = "gun_sniper", live now']);
    assert.deepEqual([made.length, made[0].model, made[0].x], [1, 'gun_sniper', 300], 'a new model: a new gun from the game\'s factory where it lies');
    assert.ok(rifle.x >= 1e7 && rifle.visible === false, 'the old one out of play');
    game.press('Delete');
    assert.ok(made[0].x >= 1e7, 'deleted');
    game.run('editor undo');
    assert.deepEqual([made.length, made[1].model, made[1].x], [2, 'gun_sniper', 300], 'back with undo where the map puts it');
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.gunFactory] = factory;
    globals[names.guns] = [];
    globals[names.mapText] = original;
  }
});

test('editor: decoration models and character skins are offered as the editor offers them, with their pictures', async () => {
  const { dropdownItems } = await import('#features/map_editor/domain/params.ts');
  const table = (globalThis as any).PB2_OPCODES;
  table.values.decor_model = { stone: 'Stone', ship: 'Broken ship' };
  table.values.char = { 1: 'Campaign Hero model', 77: 'Raven', '-1': 'Death Match model' };
  try {
    const decor = dropdownItems('decor_model');
    assert.deepEqual(decor.map((item) => [item.value, item.label, item.picture!.src]), [
      ['stone', 'Stone', '/level_editor/decors/stone.png'], ['ship', 'Broken ship', '/level_editor/decors/ship.png'],
    ]);
    const skins = dropdownItems('char');
    assert.deepEqual(skins.map((item) => [item.value, item.picture?.src ?? null]), [
      ['1', '/level_editor/chars_full/char0001.png'], ['77', '/level_editor/chars_full/char0077.png'], ['-1', null],
    ]);
  } finally {
    delete table.values.decor_model;
    delete table.values.char;
  }
});

test('editor: a lamp is found by its place, built again in its slot, its light and flare drawn with the game\'s code', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const loader = await import('#features/map_editor/services/loader.ts');
  const vm = await import('node:vm');
  const { globals, names } = game;
  const original = globals[names.mapText];
  globals.$tagBox = 'box'; globals.$tagLamp = 'lamp'; globals.$strX = '#x';
  const lightLoopCountingWithAScriptLevelLet = 'let $lampLoop = 0;';
  vm.runInThisContext(lightLoopCountingWithAScriptLevelLet);
  const frame2WithNamesThroughItsStringTableAndALightmapDrawnByItsOwnFunction = `
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
  Object.assign(globals, {
    $wallsBuilt: 0, $lampX: [7, 100], $lampY: [7, 50], $lampP: [0.45, 0.4], $lampS: [-1, 2], $lampN: 2,
    $shapes: ['fill', 'lamp shape'], $flares: [{ x: 100, y: 50, visible: true, scaleX: 1, scaleY: 1 }], $flareN: 1, $drawn: [],
    $inBg: (atX: number) => atX < 200, $lightmap: { drawWithQuality() {} }, g: 'the game\'s g',
    graphics_3d_front: { numChildren: 0, addChildAt(child: any) { this.numChildren++; return child; } },
    lens_flare: class { constructor() { Object.assign(this, { visible: true, scaleX: 1, scaleY: 1 }); } },
  });
  globals.$drawLights = vm.runInThisContext('(function $drawLights(){ $drawn=[]; for(var k=0;k<$lampN;k++) if($lampS[k]!=0) $drawn.push($shapes[k]); })');
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2WithNamesThroughItsStringTableAndALightmapDrawnByItsOwnFunction }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  try {
    globals[names.mapText] = '<lamp uid="#l1" x="100" y="50" power="0.4" flare="1" />';
    game.run('editor on');
    setLevelRunning(false); setLevelRunning(true);
    const doc = session.editorDoc()!;
    session.select(doc.byUid('#l1'));
    assert.deepEqual(runWithoutNotes('editor set x 120'), ['#l1: x = "120", live now']);
    assert.deepEqual([globals.$lampX, globals.$lampN, globals.$flares[0].visible], [[7, 120], 2, false], 'moved: its own slot 1 (slot 0 is a light of the game\'s own, along a wall), not its place in the map; the old flare out');
    assert.deepEqual([globals.$flares[1].x, globals.$flares[1].visible], [120, true], 'a new flare');
    assert.deepEqual(globals.$shapes[1], { x: 120, power: 0.4 }, 'its light');
    assert.deepEqual(globals.$drawn, ['fill', globals.$shapes[1]], 'the lightmap drawn again');
    assert.equal(vm.runInThisContext('$lampLoop'), 0, 'the game\'s loop variable as it was');
    assert.equal(globals.g, 'the game\'s g');
    runWithoutNotes('editor set flare 0');
    assert.deepEqual([globals.$lampS[1], globals.$flares[1].visible], [-1, false], 'no flare: kept inside a background');
    runWithoutNotes('editor set x 300');
    assert.deepEqual([globals.$lampS[1], globals.$lampN], [0, 2], 'out of every background without a flare: the loader does not keep it, it is put out');
    assert.deepEqual(globals.$drawn, ['fill']);
    assert.deepEqual(globals.$shapes[1], { x: 300, power: 0 }, 'a light of nothing, if a new round lights it again');
    runWithoutNotes('editor set x 150');
    assert.deepEqual([globals.$lampX[1], globals.$lampS[1], globals.$lampN], [150, -1, 2], 'back in its slot');
    game.run('editor add lamp 50 60');
    const added = session.selected()!;
    assert.deepEqual([globals.$lampN, globals.$lampX[2], globals.$lampS[2], globals.$shapes[2].x, globals.$flares.at(-1).x], [3, 50, 2, 50, 50], 'added: a new slot at the end, with its light and flare');
    assert.equal(session.pendingCount(), 0, 'in the running level');
    game.press('Delete');
    assert.deepEqual([globals.$lampS[2], globals.$flares.at(-1).visible], [0, false]);
    game.run('editor undo');
    assert.equal(globals.$lampS[2], 2, 'lit again');
    assert.equal(added.live!.index, 2);
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
    for (const key of ['$tagBox', '$tagLamp', '$strX', '$wallsBuilt', '$lampX', '$lampY', '$lampP', '$lampS', '$lampN', '$shapes',
      '$flares', '$flareN', '$drawn', '$inBg', '$lightmap', 'g', 'graphics_3d_front', 'lens_flare', '$drawLights']) delete globals[key];
  }
});

test('editor: an engine mark\'s parameter offers what its mark takes, as the editor\'s mark pairs say', async () => {
  const { paramInfo, dropdownItems } = await import('#features/map_editor/domain/params.ts');
  const table = (globalThis as any).PB2_OPCODES;
  const rows = [
    { name: 'mark', kind: 'engine_mark', title: 'Modificator', desc: 'Game modificator', cls: 'inf' },
    { name: 'forteam', kind: 'nochange', title: 'Parameter', desc: 'Modificator parameter', cls: 'inf' },
  ];
  table.params.push(...rows);
  Object.assign(table.markPairs, { sky: 'sky_model', he_nades_count: 'value>=0+round1' });
  table.values.sky_model = { 1: 'Yellow, dark', 5: 'Space' };
  try {
    assert.equal(paramInfo('inf', 'forteam', { mark: 'sky' })!.kind, 'sky_model');
    assert.deepEqual(dropdownItems(paramInfo('inf', 'forteam', { mark: 'sky' })!.kind).map((item) => [item.value, item.label, item.picture!.src]),
      [['1', 'Yellow, dark', '/level_editor/pic.php?m=1&c=6'], ['5', 'Space', '/level_editor/pic.php?m=5&c=6']]);
    assert.equal(paramInfo('inf', 'forteam', { mark: 'he_nades_count' })!.kind, 'value>=0+round1');
    assert.equal(paramInfo('inf', 'forteam', { mark: 'casual' })!.kind, 'nochange', 'a mark the table leaves out: free text');
    assert.equal(paramInfo('inf', 'forteam', {})!.kind, 'nochange', 'the default mark (hero1_guns)');
    assert.equal(paramInfo('inf', 'mark', { mark: 'sky' })!.kind, 'engine_mark');
  } finally {
    table.params.splice(table.params.length - rows.length, rows.length);
    for (const key of Object.keys(table.markPairs)) delete table.markPairs[key];
    delete table.values.sky_model;
  }
});

test('editor: movables and water take every parameter in the running level, with the loader\'s later steps', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const loader = await import('#features/map_editor/services/loader.ts');
  const vm = await import('node:vm');
  const { globals, names } = game;
  const original = globals[names.mapText];
  globals.$tagBox = 'box'; globals.$tagDoor = 'door'; globals.$tagRegion = 'region'; globals.$tagWater = 'water';
  const loaderWatchdogThatThrowsOnceTheLevelIsBuilt = 'let $watch = () => { throw new Error("Map construction took longer than 15 seconds"); };';
  vm.runInThisContext(loaderWatchdogThatThrowsOnceTheLevelIsBuilt);
  const [doors, doorCount, waters, waterCount] = [names.doors, '$doorN', names.waters, '$waterN'];
  const consoleNamesOfTheGamesDollarCounters = [[names.doorCount, '$doorN'], [names.waterCount, '$waterN'], [names.regionCount, '$regionN']];
  for (const [mine, theirs] of consoleNamesOfTheGamesDollarCounters) {
    Object.defineProperty(globals, mine, { get: () => globals[theirs], set: (value) => { globals[theirs] = value; }, configurable: true });
  }
  const [waterX, waterY, waterW, waterH, waterDamage] = [names.waterX, names.waterY, names.waterW, names.waterH, names.waterDamage];
  const frame2WithBranchesThenLaterStepsEachLoopCallingTheWatchdog = `
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
${waterX}[${waterCount}]=parseFloat(b["#x"]);
${waterY}[${waterCount}]=parseFloat(b["#y"]);
${waterW}[${waterCount}]=parseFloat(b["#w"]);
${waterH}[${waterCount}]=parseFloat(b["#h"]);
${waterDamage}[${waterCount}]=parseFloat(b["#damage"]);
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
${names.regions}[$regionN]=new Object();
${names.regions}[$regionN]["x"]=parseFloat(b["#x"]);
${names.regions}[$regionN]["y"]=parseFloat(b["#y"]);
${names.regions}[$regionN].w=parseFloat(b["#w"]);
${names.regions}[$regionN].h=parseFloat(b["#h"]);
if(b["#attach"]!=="-1"&&b["#attach"]!==""&&b["#attach"]!==undefined)
attachments.push({parent:b["#attach"],child:${names.regions}[$regionN],type:4});
$regionN++;
}
}
for(var i=0;i<attachments.length;i++)
{
$watch();
attachments[i].parent=${doors}[$doorOf(attachments[i].parent)];
if(attachments[i]["type"]==5)
{
attachments[i].dx=${waterX}[attachments[i].id]-attachments[i].parent["x"];
attachments[i].dy=${waterY}[attachments[i].id]-attachments[i].parent["y"];
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
$shown["x"]=${waterX}[i];
$shown["y"]=${waterY}[i];
$shown.scaleX=${waterW}[i]/100;
$shown.scaleY=${waterH}[i]/100;
if(${waterDamage}[i]>0)
$shown.gotoAndStop(1);
else
$shown.gotoAndStop(2);
}
${waterX}[i]-=10;
${waterW}[i]+=20;
${waterH}[i]+=10;
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
${names.textureFollows}($tex,i);
}
function ${names.textureFollows}(clip,$door)
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
  const layer = () => ({ children: [] as any[], get numChildren() { return this.children.length; },
    addChildAt(child: any, position: number) { if (child.parent) child.parent.removeChild(child); this.children.splice(position, 0, child); child.parent = this; return child; },
    removeChild(child: any) { this.children.splice(this.children.indexOf(child), 1); child.parent = null; },
    clearMCInterpolationData() {} });
  const saved = { game: globals.game, graphics_3d: globals.graphics_3d, graphics_3d_front: globals.graphics_3d_front, regions: globals[names.regions], regionCount: globals[names.regionCount] };
  const world = Object.assign(layer(), { x: saved.game.x, y: saved.game.y, scaleX: saved.game.scaleX, scaleY: saved.game.scaleY, parent: saved.game.parent });
  Object.assign(globals, {
    graphics_3d: layer(), graphics_3d_front: layer(), game: world, attachments: [], $tieClips: [], $tieDoors: [], $friction: [], $wallsBuilt: 0,
    $regionN: 0, $doorOf: (uid: string) => globals[doors].findIndex((door: any) => door.uid === uid),
    door: class { uid: string | null = null; }, water: class { frame?: number; gotoAndStop(frame: number) { this.frame = frame; } }, veh_hh: class {}, texture_front0: class {},
    [names.textureFollows]: (clip: any, door: any) => { globals.$tieClips.push(clip); globals.$tieDoors.push(door); },
    $moveTied: (index: number) => {
      for (const attachment of globals.attachments) {
        if (attachment.parent === globals[doors][index]) { attachment.child.x = globals[doors][index].x + attachment.dx; attachment.child.y = globals[doors][index].y + attachment.dy; }
      }
    },
    [doors]: [], $doorN: 0, [waters]: [], $waterN: 0, [waterX]: [], [waterY]: [], [waterW]: [], [waterH]: [], [waterDamage]: [], [names.regions]: [],
    [names.displayInit]: () => {},
  });
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2WithBranchesThenLaterStepsEachLoopCallingTheWatchdog }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  const giveLastMovableItsUidAsTheGamesUidTableWould = (uid: string | undefined) => {
    const movable = globals[doors][globals[doors].length - 1];
    movable.uid = uid;
  };
  try {
    globals[names.mapText] = '<box x="0" y="0" w="10" h="10" m="0" />';
    game.run('editor on');
    setLevelRunning(false); setLevelRunning(true);
    assert.deepEqual(runWithoutNotes('editor add door 500 0 40 10'), ['Added #door*1 at 500, 0 (40 x 10); in the running level']);
    const lift = session.selected()!;
    giveLastMovableItsUidAsTheGamesUidTableWould(lift.attrs.uid);
    const texture = globals.$tieClips[0];
    assert.deepEqual([globals[doorCount], globals.graphics_3d.children.includes(texture), globals.$tieDoors[0], texture.x, texture.scaleX], [1, true, 0, 500, 0.4], 'added: the movable and its texture, tied to it');
    assert.equal(globals.game.children.length, 2, 'two edges');
    game.run('editor add region 510 -20 20 20');
    const rider = session.selected()!;
    assert.deepEqual(runWithoutNotes(`editor set attach ${lift.attrs.uid}`), [`${rider.attrs.uid}: attach = "${lift.attrs.uid}", live now`]);
    assert.equal(globals.attachments.length, 1);
    assert.deepEqual([globals.attachments[0].parent, globals.attachments[0].dx, globals.attachments[0].dy], [globals[doors][0], 10, -20], 'a region attached to it: tied as the loader ties it');
    session.select(lift);
    assert.deepEqual(runWithoutNotes('editor set x 600'), [`${lift.attrs.uid}: x = "600", live now`]);
    assert.deepEqual([globals[doors][0].x, globals[doors][0].$startX, texture.x, globals[names.regions][0].x], [600, 600, 600, 610], 'the movable moved: its start copy for a new round, its texture, what rides on it');
    runWithoutNotes('editor set tary -50');
    assert.deepEqual([globals[doors][0].tary, globals[doors][0].$startTarY], [-50, -50]);
    const movableBefore = globals[doors][0];
    assert.deepEqual(runWithoutNotes('editor set vis false'), [`${lift.attrs.uid}: vis = "false", live now`]);
    giveLastMovableItsUidAsTheGamesUidTableWould(lift.attrs.uid);
    assert.notEqual(globals[doors][0], movableBefore, 'hidden: built again');
    assert.ok(!globals.graphics_3d.children.includes(texture), 'no texture');
    assert.equal(globals.attachments[0].parent, globals[doors][0], 'the rider on the new one');
    runWithoutNotes('editor set vis true');
    giveLastMovableItsUidAsTheGamesUidTableWould(lift.attrs.uid);
    assert.deepEqual([globals.graphics_3d.children.includes(texture), texture.x, globals.game.children.length, globals.$tieClips.length], [true, 600, 2, 1], 'shown again: the same texture back, no second pair of edges');
    for (const [attr, value, field, want] of [['maxspeed', '20', '$speed', 20], ['moving', 'true', '$moving', true], ['mute', 'true', '$sound', false]] as const) {
      assert.deepEqual(runWithoutNotes(`editor set ${attr} ${value}`), [`${lift.attrs.uid}: ${attr} = "${value}", live now`]);
      giveLastMovableItsUidAsTheGamesUidTableWould(lift.attrs.uid);
      assert.equal(globals[doors][0][field], want, attr);
    }
    assert.equal(globals[doors][0].$startSpeed, 20);

    game.run('editor add water 800 0 100 50');
    const pool = session.selected()!;
    const first = globals[waters][0];
    assert.deepEqual([globals.graphics_3d_front.children[0], first.frame, globals[waterX][0], globals[waterW][0], globals[waterH][0]], [first, 2, 790, 120, 60], 'water: shown as water, its area widened, as the loader does once the map is read');
    assert.deepEqual(runWithoutNotes('editor set damage 5'), [`${pool.attrs.uid}: damage = "5", live now`]);
    assert.ok(!globals.graphics_3d_front.children.includes(first), 'the old one off the screen');
    assert.deepEqual([globals[waters][0].frame, globals[waterDamage][0], globals[waterX][0], globals[waterW][0], globals[waterCount]], [1, 5, 790, 120, 1], 'acid: built again and shown as acid, the area widened once');
    runWithoutNotes('editor set friction false');
    assert.deepEqual(globals.graphics_3d_front.children, [], 'no friction: not shown');
    runWithoutNotes(`editor set attach ${lift.attrs.uid}`);
    const tie = globals.attachments.find((attachment: any) => attachment.type === 5);
    assert.deepEqual([tie.id, tie.parent, tie.dx], [0, globals[doors][0], 800 - 600], 'attached to the movable: tied by its index');
    assert.equal(session.pendingCount(), 0, 'all in the running level');
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
    Object.assign(globals, { game: saved.game, graphics_3d: saved.graphics_3d, graphics_3d_front: saved.graphics_3d_front, [names.regions]: saved.regions });
    for (const key of ['$tagBox', '$tagDoor', '$tagRegion', '$tagWater', 'attachments', '$tieClips', '$tieDoors', '$friction', '$wallsBuilt', '$regionN',
      '$doorOf', 'door', 'water', 'veh_hh', 'texture_front0', '$moveTied', '$shown', '$tex', '$tieN', '$k', '$doorN', '$waterN']) delete globals[key];
    for (const key of ['doors', 'doorCount', 'waters', 'waterCount', 'waterX', 'waterY', 'waterW', 'waterH', 'waterDamage', 'regionCount', 'textureFollows']) delete globals[names[key]];
    globals[names.regionCount] = saved.regionCount;
  }
});

test('editor: every parameter the game reads is in the params panel, and every one says how it reaches a running level', async () => {
  const { paramsOf } = await import('#features/map_editor/domain/params.ts');
  const { KIND_TAGS } = await import('#features/map_editor/domain/kinds.ts');
  const { liveSupport } = await import('#features/map_editor/services/apply.ts');
  const ATTRS_READ_IN_EACH_KINDS_BRANCH_OF_FRAME2: Record<string, string> = {
    box: 'x y w h m', image: 'id width height', bg: 'x y w h f c u v a m s', pushf: 'x y w h tox toy stab damage uid attach',
    water: 'attach x y w h damage friction', door: 'vis x y w h moving tarx tary maxspeed uid mute attach',
    region: 'x y w h uses_timer use_target use_on uid attach', trigger: 'execute enabled maxcalls uid', timer: 'enabled maxcalls target delay uid',
    barrel: 'model x y tox toy uid', vehicle: 'model x y tox toy uid side hpp', decor: 'model f u v x y r sx sy uid attach text',
    gun: 'model command upg uid x y', song: 'uid url volume loop callback', inf: 'mark forteam x y', lamp: 'x y power flare uid',
    player: 'x y uid hea hmax tox toy ondeath team botaction side incar char', enemy: 'x y uid hea hmax tox toy ondeath team botaction side incar char',
  };
  assert.deepEqual(Object.keys(ATTRS_READ_IN_EACH_KINDS_BRANCH_OF_FRAME2).sort(), [...KIND_TAGS].sort(), 'every kind the map loader reads (frame2.js: b["#..."] in each kind\'s branch), and no other');
  for (const tag of KIND_TAGS) {
    const shown = paramsOf(tag);
    for (const attr of ATTRS_READ_IN_EACH_KINDS_BRANCH_OF_FRAME2[tag]!.split(' ')) assert.ok(shown.includes(attr), `${tag} ${attr}: not in the panel`);
    for (const attr of shown) {
      const how = liveSupport(tag, attr);
      assert.ok(how && how !== 'the running level cannot take it', `${tag} ${attr}: no way into a running level, and no reason`);
    }
  }
});

test('editor: a wall\'s grab points go with it, where there is room beside its corners, as the loader gives them', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const loader = await import('#features/map_editor/services/loader.ts');
  const { globals, names } = game;
  const original = globals[names.mapText];
  globals.$tagBox = 'box';
  const frame2WallLoopPuttingAGrabPointAtEachTopCornerWithRoomBeside = `
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
}
for(i=0;i<${names.wallCount};i++)
{
$HОpcl=75;
if($clear(${names.wallX}[i]-15,${names.wallY}[i]-30,${names.wallX}[i]-15,${names.wallY}[i]+$HОpcl))
if($clear(${names.wallX}[i]+5,${names.wallY}[i]-5,${names.wallX}[i]+5,${names.wallY}[i]-50))
{
mc=game.addChildAt(new veh_hh,game.numChildren);
n=6;
mc["x"]=parseFloat(${names.wallX}[i]);
mc["y"]=parseFloat(${names.wallY}[i]);
$makeVehicle(mc,n,1);
}
}
`;
  const layer = () => ({ children: [] as any[], get numChildren() { return this.children.length; },
    addChildAt(child: any, position: number) { this.children.splice(position, 0, child); child.parent = this; return child; }, removeChild(child: any) { this.children.splice(this.children.indexOf(child), 1); } });
  const saved = { game: globals.game, graphics_3d: globals.graphics_3d };
  const world = Object.assign(layer(), { x: saved.game.x, y: saved.game.y, scaleX: saved.game.scaleX, scaleY: saved.game.scaleY, parent: saved.game.parent });
  const made: any[] = [];
  const anotherWallFromX = 900;
  Object.assign(globals, {
    game: world, graphics_3d: layer(), $wallsBuilt: 0, veh_hh: class {},
    $clear: (fromX: number, _fromY: number, toX: number) => fromX < anotherWallFromX && toX < anotherWallFromX,
    $makeVehicle: (grabPoint: any, model: number, side: number) => { Object.assign(grabPoint, { model, side, io: true }); made.push(grabPoint); },
    [names.displayInit]: () => {},
    [names.wallX]: [100], [names.wallY]: [100], [names.wallW]: [200], [names.wallH]: [20], [names.wallCount]: 1, [names.wallMaterial]: ['0'],
    [names.gridCell]: 100, [names.gridMinX]: -200, [names.gridMinY]: -200, [names.gridCols]: 14, [names.gridRows]: 6,
  });
  globals[names.grid] = Array.from({ length: 14 }, () => Array.from({ length: 6 }, () => []));
  globals[names.gridAddWall] = () => {};
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2WallLoopPuttingAGrabPointAtEachTopCornerWithRoomBeside }));
  const leftCornerGrabAsLoaded = Object.assign(world.addChildAt(new globals.veh_hh(), 0), { x: 100, y: 100, io: true, side: 1 });
  const rightCornerGrabAsLoaded = Object.assign(world.addChildAt(new globals.veh_hh(), 1), { x: 300, y: 100, io: true, side: -1 });
  const placeOfGrab = (grabPoint: any) => (grabPoint.io ? [grabPoint.x, grabPoint.y] : 'out');
  try {
    globals[names.mapText] = '<box x="100" y="100" w="200" h="20" m="0" />';
    game.run('editor on');
    setLevelRunning(false); setLevelRunning(true);
    session.select(session.editorDoc()!.byTag('box')[0]!);
    assert.deepEqual(runWithoutNotes('editor set x 400'), ['wall #0: x = "400", live now']);
    assert.deepEqual([placeOfGrab(leftCornerGrabAsLoaded), placeOfGrab(rightCornerGrabAsLoaded), made.length], [[400, 100], [600, 100], 0], 'moved: the same two go along');
    runWithoutNotes('editor set y 150');
    assert.deepEqual([placeOfGrab(leftCornerGrabAsLoaded), placeOfGrab(rightCornerGrabAsLoaded)], [[400, 150], [600, 150]]);
    runWithoutNotes('editor set x 750');
    assert.deepEqual([placeOfGrab(leftCornerGrabAsLoaded), placeOfGrab(rightCornerGrabAsLoaded)], [[750, 150], 'out'], 'its right corner against another wall: no room, that one is taken out');
    runWithoutNotes('editor set x 400');
    assert.equal(made.length, 1, 'room again: a new one');
    assert.deepEqual([made[0].x, made[0].y, made[0].model, made[0].side], [600, 150, 6, -1], 'made as the loader makes it: a veh_hh made a vehicle of model 6');
    game.press('Delete');
    assert.deepEqual([placeOfGrab(leftCornerGrabAsLoaded), placeOfGrab(made[0])], ['out', 'out'], 'deleted: both out of play');
    game.run('editor undo');
    assert.match(runWithoutNotes('editor add wall 0 0 100 20')[0]!, /; in the running level$/);
    assert.deepEqual(made.slice(1).map((grabPoint) => [grabPoint.x, grabPoint.y, grabPoint.side]), [[0, 0, 1], [100, 0, -1]], 'added: one at each corner with room');
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
    Object.assign(globals, saved);
    for (const key of ['$tagBox', '$wallsBuilt', 'veh_hh', '$clear', '$makeVehicle', '$HОpcl']) delete globals[key];
  }
});

test('editor reset: every edit undone in the running level and forgotten, nothing put in again', async () => {
  const session = await import('#features/map_editor/services/session.ts');
  const { globals, names } = game;
  const regions = globals[names.regions];
  const count = globals[names.regionCount];
  globals[names.regionCount] = regions.length;
  try {
    setLevelRunning(true);
    game.run('editor on');
    const doc = session.editorDoc()!;
    const redUse = doc.byUid('#red_use')!;
    const liveIndex = redUse.live!.index!;
    const mapY = regions[liveIndex].y;
    session.select(redUse);
    runWithoutNotes('editor set y 30');
    runWithoutNotes('editor set x 77');
    assert.deepEqual([regions[liveIndex].y, regions[liveIndex].x], [30, 77]);
    game.run('editor off');
    assert.deepEqual(game.run('list editor'), ['[editor: 1 changed]',
      '  in the running level; put in again when the level starts over on this map', '  ("editor reset" undoes and forgets them)']);
    assert.match(runWithoutNotes('editor reset')[0]!, /^Reset: 2 edits undone in the running level, every edit forgotten/);
    assert.equal(regions[liveIndex].y, mapY, 'the map\'s again');
    assert.deepEqual(game.run('list editor'), ['[editor] nothing']);
    game.run('editor on');
    assert.notEqual(session.editorDoc(), doc, 'on again: the map as the game has it');
    assert.equal(session.editorDoc()!.byUid('#red_use')!.attrs.y, String(mapY));
    assert.equal(runWithoutNotes('editor undo')[0], 'Nothing to undo', 'no history, nothing to put in');
    session.select(session.editorDoc()!.byUid('#red_use'));
    runWithoutNotes('editor set y 40');
    game.run('editor off');
    const gameBuildsTheLevelAgainFromTheMap = () => { regions[liveIndex].y = mapY; };
    gameBuildsTheLevelAgainFromTheMap();
    setLevelRunning(false); setLevelRunning(true);
    assert.deepEqual(runWithoutNotes('editor reset'), ['Reset: every edit forgotten; nothing is put in again when the level starts over'], 'an edit, then the level starts over with the editor off: the level is the map\'s own, so a reset only forgets it');
    game.run('editor on');
    assert.equal(regions[liveIndex].y, mapY, 'not put in again');
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.regionCount] = count;
  }
});
