// Edits reaching the running game. Some attributes can be written straight into the
// game's object, the way the map loader would have set them (frame2.js, the map
// loader): those changes are live. What a running level cannot take (an element it does
// not have, an attribute only read at load) says why, and stays in the map.
// Walls, water and pushers keep their geometry in arrays the game's integrity check
// snapshots: writing them makes the game report the client and reload the page. They
// are written like everything else; nothing hides it.
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';
import { unwrap } from '../../../../src/features/triggers/run-log.ts';
import { moveWall, textureAt } from '../../../../src/console/kernel/game/walls.ts';
import { findRect, moveRect } from '../../../../src/console/kernel/game/layers.ts';
import { boundsOf } from './kinds.js';
import { rebuildable, rebuildLive } from './rebuild.js';
import { moveGun, remakeGun } from './guns.js';
import { placeLamp } from './lamps.js';
import { setStart } from './start.js';
import { doorTexture, followMovable, placeWallEdges } from './later.js';

// Activation modes the loader rewrites: hidden use keys become the plain ones.
const LOADER_USE_ON = Object.freeze({ 8: 1, 11: 9, 12: 10, 15: 1 });
// Modes that draw a switch at load: changing to or from one is not live (the switch is not drawn).
const SWITCH_MODES = new Set([1, 9, 10]);
const ACTION_ATTR = /^actions_\d+_(type|targetA|targetB)$/;
const TRIGGER_ACTIONS_LIMIT = 100; // the loader reads actions_1 .. actions_100

const int = (v) => parseInt(v, 10);
const finite = (v) => Number.isFinite(parseFloat(v));

// One attached to a movable keeps its offset from it: built again to take a new one.
const region = {
  x: (r, v, attrs) => !attached(attrs) && finite(v) && moveRegion(r, parseFloat(v), r.y),
  y: (r, v, attrs) => !attached(attrs) && finite(v) && moveRegion(r, r.x, parseFloat(v)),
  w: (r, v, attrs) => !attached(attrs) && finite(v) && sizeRegion(r, parseFloat(v), r.h),
  h: (r, v, attrs) => !attached(attrs) && finite(v) && sizeRegion(r, r.w, parseFloat(v)),
  use_target: (r, v) => { r[GAME_FIELDS.R_TRIGGER] = game.resolveTarget(v); return true; },
  use_on: (r, v) => {
    const mode = LOADER_USE_ON[int(v)] ?? int(v);
    if (!Number.isFinite(mode) || SWITCH_MODES.has(mode) !== SWITCH_MODES.has(r[GAME_FIELDS.R_USE_ON])) return false;
    r[GAME_FIELDS.R_USE_ON] = mode;
    return true;
  },
  uses_timer: (r, v) => { r[GAME_FIELDS.R_USES_TIMER] = v === 'true' || v === '1'; return true; },
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
  t[GAME_FIELDS.T_TYPES] = types;
  t[GAME_FIELDS.T_A] = A;
  t[GAME_FIELDS.T_B] = B;
  t[GAME_FIELDS.T_ACTIONS] = types.length;
  return true;
}

// enabled and calls left are shared by triggers and timers; a new round puts back the
// copies the loader keeps (start.js).
const counted = (tag) => ({
  enabled: (t, v) => { t[GAME_FIELDS.T_ENABLED] = v === 'true'; setStart(tag, t, 'enabled', v === 'true'); return true; },
  maxcalls: (t, v) => {
    if (!Number.isFinite(int(v))) return false;
    t[GAME_FIELDS.T_MAX_CALLS] = t[GAME_FIELDS.T_CALLS] = int(v);
    return true;
  },
});

// A decoration is a display object: place, rotation and scale can change at once. One
// attached to a movable is placed by it.
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
// texture (a visible one has one in the 3D layer, that follows it) with it, and what is
// attached to it. A new round puts it back where the map puts it (start.js). One
// attached to another movable is placed by it. Its other settings build it again.
function placeDoor(mc, attrs, i) {
  if (attached(attrs)) return false;
  const r = boundsOf({ tag: 'door', attrs });
  if (!r) return false;
  const body = doorTexture(i) ?? textureAt({ x: mc.x, y: mc.y, w: mc.w, h: mc.h });
  Object.assign(mc, { x: r.x, y: r.y, w: r.w, h: r.h, scaleX: r.w / 100, scaleY: r.h / 100 });
  if (body) Object.assign(body, { x: r.x, y: r.y, scaleX: r.w / 100, scaleY: r.h / 100 });
  setStart('door', mc, 'x', r.x);
  setStart('door', mc, 'y', r.y);
  followMovable(i);
  return true;
}
const doorPlace = (mc, v, attrs, e) => placeDoor(mc, attrs, e.live.index);
const doorTarget = (key) => (mc, v) => {
  if (!finite(v)) return false;
  mc[key] = parseFloat(v);
  setStart('door', mc, key, parseFloat(v));
  return true;
};
const door = { x: doorPlace, y: doorPlace, w: doorPlace, h: doorPlace, tarx: doorTarget('tarx'), tary: doorTarget('tary') };

// A rectangle kind's new place, from all its attributes (the one that changed included).
const rectOf = (tag, attrs) => boundsOf({ tag, attrs });

// Walls: arrays, collision grid, body and trims (src/console/kernel/game/walls.ts).
const wallPlace = (i) => (v, attrs) => {
  const r = rectOf('box', attrs);
  if (!r) return false;
  const w = game.walls();
  const from = { x: w.x[i], y: w.y[i], w: w.w[i], h: w.h[i] };
  moveWall(i, r);
  placeWallEdges(from, r); // its grab points
  return true;
};

// A background: its arrays, and the rectangle drawn for it. One attached to a movable
// is drawn in a sprite of its own the movable carries.
function placeBg(i, attrs) {
  if (attrs.a !== undefined && attrs.a !== '' && attrs.a !== '-1') throw new Error('a background attached to a movable moves with it');
  const r = rectOf('bg', attrs);
  const bg = game.backgrounds();
  if (!r) return false;
  const drawn = findRect({ x: bg.x[i], y: bg.y[i], w: bg.w[i], h: bg.h[i] });
  if (!drawn) throw new Error('its drawing was not found in the level\'s layers');
  moveRect(drawn, r);
  bg.x[i] = r.x; bg.y[i] = r.y; bg.w[i] = r.w; bg.h[i] = r.h;
  return true;
}

// A pusher: corners and settings, as the loader stores them.
function placePusher(i, attrs) {
  if (attached(attrs)) throw new Error('a pusher attached to a movable moves with it');
  const r = rectOf('pushf', attrs);
  if (!r) return false;
  const p = game.pushers();
  p.x1[i] = r.x; p.y1[i] = r.y; p.x2[i] = r.x + r.w; p.y2[i] = r.y + r.h;
  return true;
}
const pusherNumber = (key) => (o, v) => { if (!finite(v)) return false; game.pushers()[key][o.index] = parseFloat(v); return true; };

// Water: the display object at the map's place, and the area it acts on, which the
// loader widens by 10 on each side and lowers by 10 (frame2.js).
const WATER_SIDE = 10, WATER_BELOW = 10;
function placeWater(i, attrs) {
  if (attached(attrs)) throw new Error('water attached to a movable moves with it');
  const r = rectOf('water', attrs);
  if (!r) return false;
  const w = game.waters();
  const shown = w.shown?.[i];
  if (shown) Object.assign(shown, { x: r.x, y: r.y, scaleX: r.w / 100, scaleY: r.h / 100 });
  w.x[i] = r.x - WATER_SIDE; w.y[i] = r.y; w.w[i] = r.w + 2 * WATER_SIDE; w.h[i] = r.h + WATER_BELOW;
  return true;
}

const each = (attrs, fn) => Object.fromEntries(attrs.map((a) => [a, fn]));
// Where the editor shows a trigger or timer: the game never reads it.
const unread = each(['x', 'y'], () => true);

const LIVE = Object.freeze({
  region: { of: (i) => (i < game.regionCount() ? game.regions()?.[i] : null), attrs: region },
  trigger: {
    of: (i) => (i < game.triggerCount() ? unwrap(game.triggers()?.[i]) : null),
    // execute: run when the level starts (and when a match starts a new round).
    attrs: { ...unread, ...counted('trigger'), execute: (t, v) => { t[GAME_FIELDS.T_AT_START] = v === 'true'; return true; } },
    other: (t, attr, v, attrs) => ACTION_ATTR.test(attr) && loadActions(t, attrs),
  },
  decor: { of: (i) => game.decors()?.[i], attrs: decor },
  door: { of: (i) => (i < game.doorCount() ? game.doors()?.[i] : null), attrs: door },
  box: {
    of: (i) => (i < game.walls().count ? { index: i } : null),
    attrs: each(['x', 'y', 'w', 'h'], (o, v, attrs) => wallPlace(o.index)(v, attrs)),
  },
  // A map gun: the game gun it is (guns.js), moved or made again.
  gun: {
    of: () => ({}),
    attrs: { x: (o, v, attrs, e) => moveGun(e), y: (o, v, attrs, e) => moveGun(e),
      model: (o, v, attrs, e) => remakeGun(e), upg: (o, v, attrs, e) => remakeGun(e), command: (o, v, attrs, e) => remakeGun(e) },
  },
  bg: {
    of: (i) => (i < game.backgrounds().count ? { index: i } : null),
    attrs: each(['x', 'y', 'w', 'h'], (o, v, attrs) => placeBg(o.index, attrs)),
  },
  pushf: {
    of: (i) => (i < game.pushers().count ? { index: i } : null),
    attrs: {
      ...each(['x', 'y', 'w', 'h'], (o, v, attrs) => placePusher(o.index, attrs)),
      tox: pusherNumber('tox'), toy: pusherNumber('toy'), stab: pusherNumber('stab'), damage: pusherNumber('damage'),
    },
  },
  // Water: its place; its damage (water or acid, shown differently), friction (shown or
  // not) and attachment build it again.
  water: {
    of: (i) => (i < game.waters().count ? { index: i } : null),
    attrs: each(['x', 'y', 'w', 'h'], (o, v, attrs) => placeWater(o.index, attrs)),
  },
  // A lamp: its light built and drawn again in its slot (lamps.js).
  lamp: {
    of: () => ({}),
    attrs: each(['uid', 'x', 'y', 'power', 'flare'], (o, v, attrs, e) => { placeLamp(e); return true; }),
  },
  timer: {
    of: (i) => (i < game.timerCount() ? game.timers()?.[i] : null),
    attrs: { ...unread, ...counted('timer'), target: (t, v) => { t[GAME_FIELDS.TIMER_TARGET] = game.resolveTarget(v); return true; } },
  },
});

const NOT_IN_GAME = 'it is not in the running level yet';
const NOT_LIVE = 'the running level cannot take it';

// Why a parameter nothing above takes cannot change in a running level: per kind, by
// attribute ('*': every other one). Each kind's parameters are either taken above, built
// again (rebuild.js), or here.
const CHARACTERS = 'characters are made when the level starts';
const READ_AT_START = Object.freeze({
  box: { m: 'a wall\'s material is drawn into the level\'s layers when it loads' },
  bg: { '*': 'a background is drawn into the level\'s layers when it loads' },
  player: { '*': CHARACTERS },
  enemy: { '*': CHARACTERS },
  vehicle: { '*': 'vehicles are made when the level starts' },
  barrel: { '*': 'barrels are made when the level starts' },
  gun: { uid: 'a gun\'s uid is only read when the level starts' },
  song: { '*': 'songs are read when the level starts' },
  inf: { '*': 'engine marks are read when the level starts' },
  image: { '*': 'custom images are read when the level starts' },
});
const readAtStart = (tag, attr) => READ_AT_START[tag]?.[attr] ?? READ_AT_START[tag]?.['*'] ?? null;

// How an edit of attr on a tag reaches a running level: 'direct' (written into the
// game's object), 'rebuild' (the object built again), or why it does not.
export function liveSupport(tag, attr) {
  const kind = LIVE[tag];
  if (kind && (kind.attrs[attr] || (kind.other && tag === 'trigger' && ACTION_ATTR.test(attr)))) return 'direct';
  const why = readAtStart(tag, attr);
  if (why) return why;
  return rebuildable(tag) ? 'rebuild' : NOT_LIVE;
}

// Writes one changed attribute of element e into the running game, at the index the
// game has it (e.live): straight into the game's object when this file knows how,
// otherwise by building the object again with the game's own loader (rebuild.js).
// Returns { live: true }, or { live: false, why }: an element the game does not have,
// an attribute nothing takes, or an error (a game name missing from an older names.js
// says so).
export function applyLive(e, attr) {
  const kind = LIVE[e.tag];
  let finer = { live: false, why: NOT_LIVE };
  try {
    const obj = kind && e.live && kind.of(e.live.index, e);
    if (kind && e.live && !obj) return { live: false, why: NOT_IN_GAME };
    const v = e.attrs[attr];
    const fn = obj && (kind.attrs[attr] || (kind.other && ((o, val, attrs) => kind.other(o, attr, val, attrs))));
    if (fn && fn(obj, v, e.attrs, e)) return { live: true };
  } catch (err) {
    finer = { live: false, why: err.message };
  }
  // Nothing finer took it: the game's loader builds the object again (rebuild.js).
  if (!e.live) return { live: false, why: NOT_IN_GAME };
  const why = readAtStart(e.tag, attr);
  if (why) return { live: false, why: finer.why !== NOT_LIVE ? finer.why : why };
  if (!rebuildable(e.tag)) return finer;
  try {
    rebuildLive(e);
    return { live: true };
  } catch (err) {
    return { live: false, why: err.message };
  }
}
