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

function parseMap(xml) {
  const tags = (name) => [...xml.matchAll(new RegExp(`<${name} [^>]*\\/>`, 'g'))].map((m) => {
    const at = {};
    for (const a of m[0].matchAll(/([A-Za-z0-9_]+)="([^"]*)"/g)) at[a[1]] = a[2];
    return at;
  });
  return { triggers: tags('trigger'), regions: tags('region'), timers: tags('timer'), players: tags('player') };
}

// Installs the fake game on globalThis, then loads and starts the real console.
// Returns helpers to drive it.
export async function bootConsole({ mapFile = path.join(REPO, 'test/fixtures/map.xml') } = {}) {
  const G = globalThis;
  const N = Object.fromEntries(nameKeys().map((k) => [k, `__pb2_${k}`]));
  N.version = 'vTEST';
  G.PB2_NAMES = N;
  const set = (k, v) => { G[N[k]] = v; };
  const log = { net: [], runs: [], printed: [] };

  const xml = fs.readFileSync(mapFile, 'utf8');
  const map = parseMap(xml);
  const index = new Map();
  for (const list of Object.values(map)) list.forEach((o, i) => index.set(o.uid, i));
  // The map loader's target fixup: "#uid" -> index, whole numbers -> numbers.
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
  set('regions', map.regions.map((at) => ({ uid: at.uid, x: +at.x, y: +at.y, [N.regionUseOn]: parseInt(at.use_on), [N.regionTrigger]: fix(at.use_target) })));
  set('regionCount', map.regions.length);
  set('timers', map.timers.map((at) => ({ uid: at.uid, [N.timerTarget]: fix(at.target) })));
  set('timerCount', map.timers.length);
  set('mapText', xml);
  set('mapVars', { var_mods: 'CTHC Lenaa', door_1: 0, size_P0: 1, SkinChatVar: '-zoom 0.9' });
  set('varSyncOn', true);

  const chars = map.players.map((at, i) => {
    const c = {
      nickname: ['you', 'bob'][i], team: +at.team, hea: +at.hea, hmax: +at.hmax, x: +at.x, y: +at.y, io: true,
      tarx: 400, tary: -300, curwea: -1, stand: true, sit: 0, tox: 0, toy: 0,
      [N.dead]: false, [N.dying]: false, [N.refPoint]: i, [N.walk]: 0, [N.jump]: 1, [N.noSwords]: false,
      [N.charIndex]: i, [N.charOnDeath]: -1, [N.aimAngle]: 0, [N.facing]: 1,
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

  set('mp', true); set('customMap', true); set('sayTrigger', -1);
  set('net', {
    RELIABLE_EXEC_TRIGGER: 'EXEC', RELIABLE_VAR_SYNC: 'VSYNC', RELIABLE_JOIN_MATCH: 'JOIN', RELIABLE_GET_MATCH_LIST: 'LIST',
    [N.netNum]: (i) => `n${i}`, [N.mapChunks]: null, Event: (...a) => log.net.push(a),
  });
  set('triggerActivator', -1); set('triggerPower', 0);
  // A runner named like the game's, reading "enabled" the way it does, so the run log
  // sees it.
  const runner = N.runTrigger;
  set('runTrigger', ({ [runner](i) { log.runs.push(i); return G[N.triggers][i][N.trigEnabled]; } })[runner]);
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
  G.document = { createElement: node, addEventListener: (t, f) => { listeners[t] = f; }, pointerLockElement: null };
  G.stage = { currentFrameLabel: 'gaming', addEventListener: (t, f) => { listeners.frame = f; }, runEvents() {} };
  G.Event = { ENTER_FRAME: 'enterFrame' };
  G.KeyboardEvent = { KEY_DOWN: 'keyDown', KEY_UP: 'keyUp' };
  G.gravity = 0.5;
  G.system_non_stop = true;
  G.game = { x: 0, y: 0, clearMCInterpolationData() {} };
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
    setMP(on) { G[N.mp] = on; },
  };
}
