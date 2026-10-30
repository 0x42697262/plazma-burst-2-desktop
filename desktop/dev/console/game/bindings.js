// Everything the console reads, writes or calls in the game, in one place. The rest of
// the console goes through `game` and never touches a game global directly.
// (stage, gravity, system_non_stop, Guns and the camera globals are the game's own
// unobfuscated names.)
import { N, nameOf, read, write, call, escName } from './names.js';
import { F } from './fields.js';
import { escapeRe } from '../core/text.js';

// Frame label of the game stage while a level is running.
const LEVEL_FRAME = 'gaming';

// The stage size in game units (index.html: <canvas width="800" height="400">).
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 400;

// Message types on the game's network class (plain property names, not obfuscated).
export const NET = Object.freeze({
  EXEC_TRIGGER: 'RELIABLE_EXEC_TRIGGER',
  VAR_SYNC: 'RELIABLE_VAR_SYNC',
  JOIN_MATCH: 'RELIABLE_JOIN_MATCH',
  GET_MATCH_LIST: 'RELIABLE_GET_MATCH_LIST',
  PING: 'RELIABLE_PING',
});

// Locked arrays the console has a name for, to say which one a scan report means.
const LOCKED_NAMED = Object.freeze(['wallX', 'wallY', 'wallW', 'wallH', 'pushToX', 'pushToY', 'pushStab',
  'pushDamage', 'waterX', 'waterY', 'waterW', 'waterH', 'waterDamage']);

const ENTER_KEY = {
  keyCode: 13, which: 13, key: 'Enter', code: 'Enter',
  ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, repeat: false,
  preventDefault() {}, stopPropagation() {}, stopImmediatePropagation() {},
};

const stageOrNull = () => (typeof stage === 'undefined' || !stage ? null : stage);

export const game = {
  // ----- Names, for the js guide -----
  typedName: (key) => escName(key), // a game name as \u escapes, which JavaScript accepts
  namesVersion: () => N.version,

  // ----- Stage -----
  inLevelFrame: () => { const st = stageOrNull(); return !!st && st.currentFrameLabel === LEVEL_FRAME; },
  // The stage and the UI overlay exist, so the console can attach.
  ready: () => {
    const st = stageOrNull();
    return !!st && typeof st.addEventListener === 'function' && typeof Event !== 'undefined'
      && !!Event.ENTER_FRAME && !!game.overlay();
  },
  onEnterFrame: (fn) => stage.addEventListener(Event.ENTER_FRAME, fn),
  overlay: () => { const ui = read('uiOverlay'); return ui && ui.overlay; },
  isRunning: () => system_non_stop,
  setRunning: (v) => { system_non_stop = v; },

  // ----- Characters -----
  chars: () => read('chars'),
  me: () => read('me'), // your character's index
  charCount: () => read('charCount'), // character slots in use
  playerDt: () => read('playerDt'), // player time factor for the next tick
  keyUp: () => read('keyUp'), // jump key held
  keyDown: () => read('keyDown'), // crouch key held
  refreshChar: (i) => call('refreshChar', i), // re-evaluates held weapon and swords
  // The game's heal/revive (the defibrillator): (target, healer, power, force). The
  // healer must be on the target's team, otherwise it deals damage instead.
  healChar: (i, healer, power) => call('healChar', i, healer, power, true),
  // Re-checks body part HP: breaks parts at <= 0 HP, restores parts that have HP again.
  updateBody: (i) => call('updateBody', i),
  spectating: () => read('spectating'),

  // ----- Physics points: characters and guns are made of these -----
  ptX: () => read('ptX'),
  ptY: () => read('ptY'),
  ptPrevX: () => read('ptPrevX'),
  ptPrevY: () => read('ptPrevY'),
  ptVelX: () => read('ptVelX'),
  ptVelY: () => read('ptVelY'),
  ptCount: () => read('ptCount'),
  ptOwner: () => read('ptOwner'), // character index, or gunPtBase + gun index
  gunPtBase: () => read('gunPtBase'),
  gunPtRange: () => read('gunPtRange'),
  interpolating: () => call('interpolating'),
  clearPtInterp: (i) => call('clearPtInterp', i),
  wakePt: (i) => call('wakePt', i),
  // Camera and teleport effect, as the map trigger "move character to region" does it
  // (actions.js, case 30).
  cameraFollowsMe: () => read('cameraTarget') !== -1 || !read('spectating'),
  moveCamera: (dx, dy) => {
    const cam = globalThis.game;
    cam.x += dx;
    cam.y += dy;
    cam.clearMCInterpolationData();
    graphics_3d.clearMCInterpolationData();
    graphics_3d_front.clearMCInterpolationData();
  },
  teleportFx: (x, y) => call('effect', x, y, read('effectTypes')[nameOf('effectTeleport')], 0, 0),

  // ----- Drawing over the game -----
  // The canvas the game draws on (scripts/main.js), and the camera, read the way the
  // game's own debug view (the "debug 1" chat command) uses them: the stage is
  // GAME_WIDTH x GAME_HEIGHT units, drawn at canvas.width / GAME_WIDTH pixels per unit,
  // and the world goes through game.x/y and game.scaleX/Y (zoom), inside game.parent.
  // Read only: these are anti-cheat guarded values (ANTICHEAT.md 3.3, slots 46-51).
  gameCanvas: () => (typeof game_canvas === 'undefined' ? null : game_canvas),
  camera: () => {
    const g = globalThis.game;
    if (!g) return null;
    const p = g.parent || {};
    return {
      x: g.x, y: g.y, scaleX: g.scaleX, scaleY: g.scaleY,
      parentX: p.x || 0, parentY: p.y || 0, parentScaleX: p.scaleX ?? 1, parentScaleY: p.scaleY ?? 1,
    };
  },

  // ----- World -----
  getGravity: () => gravity,
  setGravity: (v) => { gravity = v; },

  // ----- Guns and bullets -----
  guns: () => read('guns'),
  bullets: () => read('bullets'), // ring buffer
  spawnGun: (model, params) => call('gunFactory', model, params), // gun or null
  gunName: (model) => call('gunName', model), // display name, '' if unknown
  gunScripts: () => Guns.gun_class_scripts, // class name -> init script
  // Every model the gun factory knows: it compares each one through
  // strDecode(<string variable>, ...), so the variables name them all.
  gunModels: () => {
    const models = [];
    const src = String(read('gunFactory'));
    for (const m of src.matchAll(new RegExp(`${escapeRe(N.strDecode)}\\((\\$[^,()]+),`, 'g'))) {
      const v = globalThis[m[1]];
      if (typeof v === 'string' && !models.includes(v)) models.push(v);
    }
    return models;
  },
  // The slot a gun model goes in, from its class init script.
  gunSlotOf: (cls) => {
    const src = Guns.gun_class_scripts[cls]?.frames?.['1'];
    const m = typeof src === 'string' && src.match(new RegExp(`\\.${escapeRe(F.G_SLOT)}=(-?\\d+)`));
    return m ? Number(m[1]) : null;
  },

  // ----- Level end -----
  // '' while playing, 'failed' after you (or your team) die in single-player.
  levelState: () => read('levelState'),
  setLevelState: (v) => write('levelState', v),
  fadeOverlay: () => read('fadeOverlay'), // black fade; at alpha 1 the game pauses
  setFailText: (v) => write('failText', v), // "BAD LUCK, YOU DIED." etc.

  // ----- Map triggers, regions, timers -----
  triggers: () => read('triggers'),
  triggerCount: () => read('triggerCount'),
  regions: () => read('regions'),
  regionCount: () => read('regionCount'),
  timers: () => read('timers'),
  decors: () => read('decors'), // display objects, in map order
  doors: () => read('doors'), // movables: display objects, in map order
  doorCount: () => read('doorCount'),
  // Walls: parallel arrays by wall index, and the collision grid built from them. The
  // arrays are ones the game's integrity check snapshots (editor/apply.js).
  walls: () => ({ x: read('wallX'), y: read('wallY'), w: read('wallW'), h: read('wallH'), count: read('wallCount') }),
  wallGrid: () => ({
    cells: read('grid'), cell: read('gridCell'), cols: read('gridCols'), rows: read('gridRows'),
    minX: read('gridMinX'), minY: read('gridMinY'),
  }),
  addWallToGrid: (i) => call('gridAddWall', i),
  wallMaterials: () => read('wallMaterial'),
  setWallCount: (n) => write('wallCount', n),
  // A display object the loader puts on screen ignores the mouse; a visible movable's
  // texture follows the movable by index.
  initDisplay: (shown) => call('displayInit', shown),
  textureFollows: (texture, door) => call('textureFollows', texture, door),
  // The 3D layer every wall body is drawn in, one texture_front0 per wall (frame2.js).
  wallLayer: () => (typeof graphics_3d === 'undefined' ? null : graphics_3d),
  wallTexture: () => (typeof texture_front0 === 'undefined' ? null : texture_front0),
  frontLayer: () => (typeof graphics_3d_front === 'undefined' ? null : graphics_3d_front), // drawn over characters
  // Backgrounds, pushers and water: parallel arrays by index, as the loader keeps them.
  backgrounds: () => ({ x: read('bgX'), y: read('bgY'), w: read('bgW'), h: read('bgH'), count: read('bgCount') }),
  pushers: () => ({
    x1: read('pushX1'), y1: read('pushY1'), x2: read('pushX2'), y2: read('pushY2'), count: read('pushCount'),
    tox: read('pushToX'), toy: read('pushToY'), stab: read('pushStab'), damage: read('pushDamage'),
  }),
  waters: () => ({
    shown: read('waters'), x: read('waterX'), y: read('waterY'), w: read('waterW'), h: read('waterH'),
    damage: read('waterDamage'), count: read('waterCount'),
  }),
  timerCount: () => read('timerCount'),
  sayTrigger: () => read('sayTrigger'), // the map's "player says" trigger (-1/undefined = none)
  setSayTrigger: (v) => write('sayTrigger', v),
  triggerActivator: () => read('triggerActivator'),
  setTriggerActivator: (v) => write('triggerActivator', v),
  triggerPower: () => read('triggerPower'),
  setTriggerPower: (v) => write('triggerPower', v),
  // Runs a trigger if it is enabled with calls left (always returns true in a level).
  runTrigger: (i) => call('runTrigger', i),
  runTriggerName: () => N.runTrigger, // its function name, as seen on a stack frame
  // An action target as the map loader stores it: "#uid" -> that object's index (left
  // as text when no object has it), "12" -> 12, other text as is.
  resolveTarget: (v) => call('resolveTarget', v),

  // ----- Map variables and map text -----
  mapVars: () => read('mapVars'), // variable name -> value
  varSyncOn: () => read('varSyncOn') === true, // the map's "var_sync" engine mark
  mapText: () => read('mapText'),
  setMapText: (text) => write('mapText', text),

  // ----- Multiplayer -----
  isMP: () => read('mp'),
  setMP: (v) => write('mp', v),
  messageType: (name) => read('net')[name],
  // You ran trigger i: every other client runs it too, with you as the activator. Same
  // message the game sends after a shot at a movable (frame2.js), or, with the region's
  // index, after a region fires (receivers only check that the region exists).
  sendTriggerRun: (i, region) => {
    const net = read('net');
    const num = net[nameOf('netNum')];
    net.Event(net[NET.EXEC_TRIGGER], num(i), region === undefined ? '' : num(region), '');
  },
  // The call the game's own sync actions make: type, mode, name, value.
  sendVarSync: (mode, name, value) => {
    const net = read('net');
    if (!net || typeof net.Event !== 'function') throw new Error('the game network class is not available');
    net.Event(net[NET.VAR_SYNC], mode, name, value);
  },
  lobbyConnection: () => { const net = read('net'); return net && net[nameOf('lobbyConn')]; },
  matchMapId: () => { const d = read('net').match_details; return d && d.map_id; }, // map of the match you are in
  mapId: () => read('mapId'), // map loaded last: campaign "c31a" or a custom map ID
  sendMethodName: () => nameOf('netSend'),
  // Recent network messages, oldest first: { type, parts, time }. Every message sent is
  // added (parts as sent, as strings); received ones only with the game's TRACK_MP_LOGS.
  netLog: () => { const net = read('net'); return (net && net[nameOf('netLog')]) || []; },

  // ----- Anti-cheat -----
  // The console name of locked array i (the scan's code 3 detail), or null.
  lockedArrayName: (i) => {
    const arr = (read('lockedArrays') || [])[i];
    return (arr && LOCKED_NAMED.find((k) => N[k] && read(k) === arr)) || null;
  },
  lockedArrayCount: () => (read('lockedArrays') || []).length,
  clearMapChunks: () => { read('net')[nameOf('mapChunks')] = null; },

  // ----- Chat -----
  chatTyping: () => read('chatTyping'), // the game's chat input is open
  openChat: (text) => call('openChat', text), // opens chat prefilled with text
  isCustomMap: () => read('customMap'), // custom map: chat goes to the map's triggers
  setCustomMap: (v) => write('customMap', v),
  chatPopups: () => read('chatPopups'), // floating chat messages (HUD mode)
  chatPanel: () => read('chatPanel'), // chat log panel, if shown
  pressEnter: () => stage.runEvents(KeyboardEvent.KEY_DOWN, ENTER_KEY),
  releaseEnter: () => stage.runEvents(KeyboardEvent.KEY_UP, ENTER_KEY),
};
