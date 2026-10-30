// Edits reaching the running game. Some attributes can be written straight into the
// game's object, the way the map loader would have set them (frame2.js, the map
// loader): those changes are live. Anything else waits for the level to load the map
// again (single-player: "editor reload").
// Walls, backgrounds, water and pushers are not written live: the game keeps their
// geometry in arrays its integrity check snapshots, and a change there makes the game
// report the client and reload. The game's own loader builds them from the edited map
// on a reload instead ("editor_autoreload" does that by itself). Walls only go live
// when "editor livewalls" was turned on, which says so first (unsafe.js).
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { unwrap } from '../triggers/log.js';
import { moveWall, textureAt } from '../game/walls.js';
import { boundsOf } from './kinds.js';
import { liveWallsOn } from './unsafe.js';

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

// A movable is a display object: its place, size and destination change at once, its
// texture (a visible one has one in the 3D layer) with it. One attached to another
// movable is placed by it.
function placeDoor(mc, attrs) {
  if (attached(attrs)) return false;
  const r = boundsOf({ tag: 'door', attrs });
  if (!r) return false;
  const body = textureAt({ x: mc.x, y: mc.y, w: mc.w, h: mc.h });
  Object.assign(mc, { x: r.x, y: r.y, w: r.w, h: r.h, scaleX: r.w / 100, scaleY: r.h / 100 });
  if (body) Object.assign(body, { x: r.x, y: r.y, scaleX: r.w / 100, scaleY: r.h / 100 });
  return true;
}
const doorPlace = (mc, v, attrs) => placeDoor(mc, attrs);
const door = {
  x: doorPlace, y: doorPlace, w: doorPlace, h: doorPlace,
  tarx: (mc, v) => { if (!finite(v)) return false; mc.tarx = parseFloat(v); return true; },
  tary: (mc, v) => { if (!finite(v)) return false; mc.tary = parseFloat(v); return true; },
};

// Walls: only with "editor livewalls" on, inside the level's grid. The reasons they are
// not live are errors, so the editor can say them.
const wallPlace = (i) => (v, attrs) => {
  if (!liveWallsOn()) throw new Error('walls change on a reload ("editor livewalls on" moves them live)');
  const r = boundsOf({ tag: 'box', attrs });
  if (!r) return false;
  moveWall(i, r);
  return true;
};

const LIVE = Object.freeze({
  region: { of: (i) => (i < game.regionCount() ? game.regions()?.[i] : null), attrs: region },
  trigger: {
    of: (i) => (i < game.triggerCount() ? unwrap(game.triggers()?.[i]) : null),
    attrs: counted,
    other: (t, attr, v, attrs) => ACTION_ATTR.test(attr) && loadActions(t, attrs),
  },
  decor: { of: (i) => game.decors()?.[i], attrs: decor },
  door: { of: (i) => (i < game.doorCount() ? game.doors()?.[i] : null), attrs: door },
  box: {
    of: (i) => (i < game.walls().count ? { wall: i } : null),
    attrs: Object.fromEntries(['x', 'y', 'w', 'h'].map((a) => [a, (o, v, attrs) => wallPlace(o.wall)(v, attrs)])),
  },
  timer: {
    of: (i) => (i < game.timerCount() ? game.timers()?.[i] : null),
    attrs: { ...counted, target: (t, v) => { t[F.TIMER_TARGET] = game.resolveTarget(v); return true; } },
  },
});

const NOT_IN_GAME = 'it is not in the running level yet';
const NOT_LIVE = 'the running level cannot take it';

// Writes one changed attribute of element e into the running game, at the index the
// game has it (e.live). Returns { live: true }, or { live: false, why } when it needs
// the map loaded again: an element the game does not have yet, an attribute it cannot
// take, or an error (a game name missing from an older names.js says so).
export function applyLive(e, attr) {
  const kind = LIVE[e.tag];
  if (!kind) return { live: false, why: NOT_LIVE };
  try {
    const obj = e.live && kind.of(e.live.index);
    if (!obj) return { live: false, why: NOT_IN_GAME };
    const v = e.attrs[attr];
    const fn = kind.attrs[attr] || (kind.other && ((o, val, attrs) => kind.other(o, attr, val, attrs)));
    return fn && fn(obj, v, e.attrs) ? { live: true } : { live: false, why: NOT_LIVE };
  } catch (err) {
    return { live: false, why: err.message };
  }
}
