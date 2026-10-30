// Edits reaching the running game. Some attributes can be written straight into the
// game's object, the way the map loader would have set them (frame2.js, the map
// loader): those changes are live. Anything else waits for the level to load the map
// again (single-player: "editor reload").
// Walls, movables, backgrounds, water and pushers are never written live: the game
// keeps their geometry in arrays its integrity check snapshots, and a change there
// makes the game report the client and reload. The game's own loader builds them from
// the edited map on a reload instead.
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { unwrap } from '../triggers/log.js';

// Activation modes the loader rewrites: hidden use keys become the plain ones.
const LOADER_USE_ON = Object.freeze({ 8: 1, 11: 9, 12: 10, 15: 1 });
// Modes that draw a switch at load: changing to or from one needs a reload.
const SWITCH_MODES = new Set([1, 9, 10]);
const ACTION_ATTR = /^actions_\d+_(type|targetA|targetB)$/;
const TRIGGER_ACTIONS_LIMIT = 100; // the loader reads actions_1 .. actions_100

const int = (v) => parseInt(v, 10);
const finite = (v) => Number.isFinite(parseFloat(v));

const region = {
  x: (r, v) => finite(v) && moveRegion(r, parseFloat(v), r.y),
  y: (r, v) => finite(v) && moveRegion(r, r.x, parseFloat(v)),
  w: (r, v) => finite(v) && sizeRegion(r, parseFloat(v), r.h),
  h: (r, v) => finite(v) && sizeRegion(r, r.w, parseFloat(v)),
  use_target: (r, v) => { r[F.R_TRIGGER] = game.resolveTarget(v); return true; },
  use_on: (r, v) => {
    const mode = LOADER_USE_ON[int(v)] ?? int(v);
    if (!Number.isFinite(mode) || SWITCH_MODES.has(mode) !== SWITCH_MODES.has(r[F.R_USE_ON])) return false;
    r[F.R_USE_ON] = mode;
    return true;
  },
  uses_timer: (r, v) => { r[F.R_USES_TIMER] = v === 'true' || v === '1'; return true; },
};

// A use-key region has its switch drawn at its centre.
function placeSwitch(r) {
  if (r.mc) { r.mc.x = r.x + r.w / 2; r.mc.y = r.y + r.h / 2; }
}
function moveRegion(r, x, y) { r.x = x; r.y = y; placeSwitch(r); return true; }
function sizeRegion(r, w, h) { r.w = w; r.h = h; placeSwitch(r); return true; }

// A trigger's actions as the loader stores them: types as numbers, targets resolved.
function loadActions(t, attrs) {
  const types = [];
  const A = [];
  const B = [];
  for (let i = 1; i <= TRIGGER_ACTIONS_LIMIT; i++) {
    const type = attrs[`actions_${i}_type`];
    if (type === undefined || type === '-1') continue;
    types.push(int(type));
    A.push(game.resolveTarget(attrs[`actions_${i}_targetA`]));
    B.push(game.resolveTarget(attrs[`actions_${i}_targetB`]));
  }
  t[F.T_TYPES] = types;
  t[F.T_A] = A;
  t[F.T_B] = B;
  t[F.T_ACTIONS] = types.length;
  return true;
}

// enabled and calls left are shared by triggers and timers.
const counted = {
  enabled: (t, v) => { t[F.T_ENABLED] = v === 'true'; return true; },
  maxcalls: (t, v) => {
    if (!Number.isFinite(int(v))) return false;
    t[F.T_MAX_CALLS] = t[F.T_CALLS] = int(v);
    return true;
  },
};

// A decoration is a display object: place, rotation and scale can change at once. One
// attached to a movable is placed by it, so that waits for a reload.
const attached = (attrs) => attrs.attach !== undefined && attrs.attach !== '' && attrs.attach !== '-1';
const decorNumber = (prop, fallback) => (mc, v, attrs) => {
  if (attached(attrs)) return false;
  const n = v === '' || v === undefined ? fallback : parseFloat(v);
  if (!Number.isFinite(n)) return false;
  mc[prop] = n;
  return true;
};
const decor = {
  x: decorNumber('x'), y: decorNumber('y'), r: decorNumber('rotation', 0),
  sx: decorNumber('scaleX', 1), sy: decorNumber('scaleY', 1),
};

const LIVE = Object.freeze({
  region: { of: (i) => game.regions()?.[i], attrs: region },
  trigger: {
    of: (i) => unwrap(game.triggers()?.[i]),
    attrs: counted,
    other: (t, attr, v, attrs) => ACTION_ATTR.test(attr) && loadActions(t, attrs),
  },
  decor: { of: (i) => game.decors()?.[i], attrs: decor },
  timer: {
    of: (i) => game.timers()?.[i],
    attrs: { ...counted, target: (t, v) => { t[F.TIMER_TARGET] = game.resolveTarget(v); return true; } },
  },
});

// Writes one changed attribute of element e (index i in the game) into the running
// game. True when it is live now; false when it needs the map loaded again.
export function applyLive(e, i, attr) {
  const kind = LIVE[e.tag];
  const obj = kind && kind.of(i);
  if (!obj) return false;
  const v = e.attrs[attr];
  const fn = kind.attrs[attr];
  if (fn) return !!fn(obj, v, e.attrs);
  return kind.other ? !!kind.other(obj, attr, v, e.attrs) : false;
}
