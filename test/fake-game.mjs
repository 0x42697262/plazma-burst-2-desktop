// A fake Plazma Burst 2 runtime for testing the dev console without the game. Every
// game name is "__pb2_<key>"; the keys come from tools/find-names.js (the same RULES
// that generate desktop/dev/names.js), so a fresh clone needs neither names.js nor the
// game. Triggers, regions, timers and players come from a map file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONSOLE_ENTRY = path.join(REPO, 'desktop/dev/console/index.js');

// Every key the console can ask names.js for: the "keys" of find-names.js RULES.
function nameKeys() {
  const src = fs.readFileSync(path.join(REPO, 'tools/find-names.js'), 'utf8');
  const keys = new Set();
  for (const m of src.matchAll(/keys:\s*\[([^\]]*)\]/g)) {
    for (const k of m[1].matchAll(/'([^']+)'/g)) if (k[1] !== '_') keys.add(k[1]);
  }
  return [...keys];
}

// Region modes the map loader rewrites (frame2.js): 8, 11, 12 and 15 are use keys.
const LOADER_MODES = Object.freeze({ 8: 1, 11: 9, 12: 10, 15: 1 });

function parseMap(xml) {
  const tags = (name) => [...xml.matchAll(new RegExp(`<${name} [^>]*\\/>`, 'g'))].map((m) => {
    const at = {};
    for (const a of m[0].matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) at[a[1]] = a[2];
    return at;
  });
  return { triggers: tags('trigger'), regions: tags('region'), timers: tags('timer'), players: tags('player') };
}

// A few of the map editor's actions (desktop/dev/opcodes.js has them all).
const FAKE_OPCODES = Object.freeze({
  aliases: { MovableTo: 0, TimerDisable: 26, 'next if VarA == ValueB': 123, SetVar: 100 },
  actions: {
    0: { desc: "Movable › Force Movable 'A' move to region 'B'", a: 'door', b: 'region', alias: 'MovableTo' },
    26: { desc: "Timer › Deactivate Timer 'A'", a: 'timer', b: 'nochange', alias: 'TimerDisable' },
    100: { desc: "Var › Set variable 'A' to value 'B'", a: 'string', b: 'string', alias: 'SetVar' },
    123: { desc: "Var › Skip next trigger action if value of variable 'A' does not equals value 'B'", a: 'string', b: 'string', alias: 'next if VarA == ValueB' },
    562: { desc: 'Debug › Something without a name', a: 'string', b: 'string' },
  },
});

// Installs the fake game on globalThis, then loads and starts the real console.
// Returns helpers to drive it.
// sayTrigger: uid of the map's "player says" trigger (the game sets it when the map runs).
export async function bootConsole({ mapFile = path.join(REPO, 'test/fixtures/map.xml'), sayTrigger } = {}) {
  const G = globalThis;
  const N = Object.fromEntries(nameKeys().map((k) => [k, `__pb2_${k}`]));
  N.version = 'vTEST';
  G.PB2_NAMES = N;
  G.PB2_OPCODES = FAKE_OPCODES;
  const set = (k, v) => { G[N[k]] = v; };
  const log = { net: [], runs: [], ran: [], printed: [] };

  const xml = fs.readFileSync(mapFile, 'utf8');
  const map = parseMap(xml);
  const index = new Map();
  for (const list of Object.values(map)) list.forEach((o, i) => index.set(o.uid, i));
  // The map loader's target fixup: "#uid" -> index, whole numbers -> numbers.
  // The loader's uid registry has every object of the map, in the order listed.
  const uidIndex = new Map();
  const perTag = {};
  for (const m of xml.matchAll(/<(\w+) uid="([^"]*)"/g)) {
    perTag[m[1]] = (perTag[m[1]] ?? -1) + 1;
    if (!uidIndex.has(m[2])) uidIndex.set(m[2], perTag[m[1]]);
  }
  set('resolveTarget', (v) => {
    const t = String(v ?? '-1');
    if (t.charAt(0) === '#') return uidIndex.has(t) ? uidIndex.get(t) : t;
    return parseInt(t) + '' === t ? parseInt(t) : t;
  });
  const fix = (v = '-1') => (v.charAt(0) === '#' ? (index.has(v) ? index.get(v) : v) : parseInt(v) + '' === v ? parseInt(v) : v);
  const triggers = map.triggers.map((at) => {
    const t = { uid: at.uid, [N.trigTargetA]: [], [N.trigTargetB]: [], [N.trigTypes]: [] };
    let n = 0;
    for (let i = 1; at[`actions_${i}_type`] !== undefined; i++, n++) {
      t[N.trigTypes].push(parseInt(at[`actions_${i}_type`]));
      t[N.trigTargetA].push(fix(at[`actions_${i}_targetA`]));
      t[N.trigTargetB].push(fix(at[`actions_${i}_targetB`]));
    }
    Object.assign(t, {
      [N.trigActionCount]: n, [N.trigEnabled]: at.enabled === 'true', [N.trigAtStart]: at.execute === 'true',
      [N.trigMaxCalls]: parseInt(at.maxcalls), [N.trigCalls]: parseInt(at.maxcalls),
    });
    return t;
  });
  set('triggers', triggers); set('triggerCount', triggers.length);
  set('regions', map.regions.map((at) => ({
    // The loader's own rewrite: hidden use keys become the plain ones.
    x: +at.x, y: +at.y, w: +(at.w ?? 0), h: +(at.h ?? 0), [N.regionUseOn]: LOADER_MODES[parseInt(at.use_on)] ?? parseInt(at.use_on),
    [N.regionTrigger]: fix(at.use_target), [N.regionUsesTimer]: at.uses_timer === 'true',
  })));
  set('regionCount', map.regions.length);
  set('timers', map.timers.map((at) => ({ [N.timerTarget]: fix(at.target), [N.trigEnabled]: at.enabled === 'true' })));
  set('timerCount', map.timers.length);
  set('mapText', xml);
  set('mapVars', { var_mods: 'CTHC Lenaa', door_1: 0, size_P0: 1, SkinChatVar: '-zoom 0.9' });
  set('varSyncOn', true);

  const chars = map.players.map((at, i) => {
    const c = {
      nickname: at.nick || `p${i}`, team: +at.team, [N.charVehicle]: -1, [N.charHuman]: at.human !== 'false', hea: +at.hea, hmax: +at.hmax, x: +at.x, y: +at.y, io: true,
      tarx: 400, tary: -300, curwea: -1, stand: true, sit: 0, tox: 0, toy: 0,
      [N.dead]: false, [N.dying]: false, [N.refPoint]: i, [N.walk]: 0, [N.jump]: 1, [N.noSwords]: false,
      [N.charIndex]: i, [N.charOnDeath]: fix(at.ondeath), [N.aimAngle]: 0, [N.facing]: 1,
      [N.headHp]: 50, [N.faceHp]: 80, [N.legsHp]: 60, [N.armsHp]: 50,
      [N.headOff]: false, [N.faceGone]: false, [N.legsBroken]: false, [N.armsBroken]: false,
      [N.afterMove]() {},
    };
    for (let sl = 1; sl <= 9; sl++) c['slot' + sl] = -1;
    return c;
  });
  set('chars', chars); set('me', 0); set('charCount', chars.length);
  set('ptX', chars.map((c) => c.x)); set('ptY', chars.map((c) => c.y));
  set('ptPrevX', chars.map((c) => c.x)); set('ptPrevY', chars.map((c) => c.y));
  set('ptCount', chars.length); set('ptOwner', chars.map((_, i) => i)); set('gunPtBase', 1000); set('gunPtRange', 100);
  set('ptVelX', []); set('ptVelY', []);
  set('interpolating', () => false); set('clearPtInterp', () => {}); set('wakePt', () => {});
  set('cameraTarget', -1); set('spectating', false);
  set('effect', () => {}); set('effectTypes', { [N.effectTeleport]: 7 });
  set('playerDt', 1); set('keyUp', false); set('keyDown', false); set('chatTyping', false);
  set('refreshChar', () => {}); set('healChar', () => {}); set('updateBody', () => {});
  set('levelState', ''); set('failText', ''); set('fadeOverlay', null);
  set('guns', []); set('bullets', []);
  G.Guns = { gun_class_scripts: { gun_rifle: { frames: { 1: `.${N.gunSlot}=1;` } } } };
  set('gunFactory', (model, params) => ({ model, upg: params.upg, [N.gunSlot]: 1, [N.charIndex]: 0, [N.gunFixed]: false }));
  set('gunName', (m) => ({ gun_rifle: 'Assault Rifle' }[m] || ''));

  set('mp', true); set('customMap', true); set('sayTrigger', sayTrigger && index.has(sayTrigger) ? index.get(sayTrigger) : -1);
  set('net', {
    RELIABLE_EXEC_TRIGGER: 'EXEC', RELIABLE_VAR_SYNC: 'VSYNC', RELIABLE_JOIN_MATCH: 'JOIN', RELIABLE_GET_MATCH_LIST: 'LIST',
    [N.netNum]: (i) => `n${i}`, [N.mapChunks]: null, Event: (...a) => log.net.push(a),
  });
  set('triggerActivator', -1); set('triggerPower', 0);
  // A runner named like the game's, reading "enabled" the way it does, so the run log
  // sees it.
  const runner = N.runTrigger;
  set('runTrigger', ({ [runner](i) {
    log.runs.push(i);
    const t = G[N.triggers][i];
    log.ran.push({ i, uid: t.uid, types: [...t[N.trigTypes]], A: [...t[N.trigTargetA]], B: [...t[N.trigTargetB]], by: G[N.triggerActivator] });
    return t[N.trigEnabled];
  } })[runner]);
  set('openChat', () => {}); set('chatPopups', []); set('chatPanel', null);

  // Browser and stage: just enough for the panel to build and frames to run.
  // A DOM node with what the panel and the log use: children, trimming, clearing.
  const node = () => ({
    style: {}, childNodes: [], parent: null,
    get textContent() { return ''; },
    set textContent(v) { this.childNodes = []; },
    get firstChild() { return this.childNodes[0]; },
    append(c) { if (c && typeof c === 'object') c.parent = this; this.childNodes.push(c); },
    remove() { if (this.parent) this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1); },
    addEventListener() {}, contains(t) { return t === this || this.childNodes.includes(t); }, focus() {}, blur() {},
  });
  const listeners = {};
  set('uiOverlay', { overlay: node() });
  G.document = { createElement: (tag) => (tag === 'canvas' ? canvasNode(0, 0) : node()), addEventListener: (t, f) => { listeners[t] = f; }, pointerLockElement: null };
  G.stage = { currentFrameLabel: 'gaming', addEventListener: (t, f) => { listeners.frame = f; }, runEvents() {} };
  G.Event = { ENTER_FRAME: 'enterFrame' };
  G.KeyboardEvent = { KEY_DOWN: 'keyDown', KEY_UP: 'keyUp' };
  G.gravity = 0.5;
  G.system_non_stop = true;
  G.game = { x: 0, y: 0, scaleX: 1, scaleY: 1, parent: { x: 0, y: 0, scaleX: 1, scaleY: 1 }, clearMCInterpolationData() {} };
  // The game canvas at resolution 2 (two pixels per game unit), and a 2D context that
  // records what is drawn instead of drawing it.
  const drawn = [];
  const recorder = () => new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => drawn.push([k, ...args])),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const canvasNode = (w, h) => ({ ...node(), width: w, height: h, getContext: () => recorder(),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w / 2, height: h / 2 }), after() {}, remove() {} });
  G.game_canvas = canvasNode(1600, 800);
  G.game_canvas.style.zIndex = '2';
  log.drawn = drawn;
  const frames = [];
  G.requestAnimationFrame = (fn) => frames.push(fn);
  G.cancelAnimationFrame = () => { frames.length = 0; };
  log.frames = frames;
  G.graphics_3d = G.graphics_3d_front = { clearMCInterpolationData() {} };
  const store = new Map();
  G.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  G.fetch = () => Promise.reject(new Error('no desktop wrapper in tests'));
  const intervals = [];
  G.setInterval = (fn) => intervals.push(fn);
  G.clearInterval = () => {};
  const realLog = console.log;
  console.log = (...a) => { const line = a.join(' '); if (line.startsWith('[pb2dev] ')) log.printed.push(line.slice(9)); else realLog(...a); };

  await import(pathToFileURL(CONSOLE_ENTRY).href);
  await new Promise((r) => setImmediate(r));
  intervals.shift()(); // the boot poll finds the game ready and starts the console

  return {
    G, N, log, store, chars, triggers,
    player: chars[0],
    // Runs a line and returns what it printed (without the echoed command).
    run(line) {
      log.printed.length = 0;
      G.pb2dev.run(line);
      return log.printed.filter((l) => !l.startsWith('> '));
    },
    frame(n = 1) { for (let i = 0; i < n; i++) listeners.frame(); },
    // Presses a key (KeyboardEvent.code) with the console closed; returns what it printed.
    press(code, mods = {}) {
      log.printed.length = 0;
      const e = { code, key: code, target: null, repeat: false, preventDefault() {}, stopImmediatePropagation() {}, ...mods };
      listeners.keydown(e);
      listeners.keyup(e);
      return log.printed.slice();
    },
    setMP(on) { G[N.mp] = on; },
  };
}
