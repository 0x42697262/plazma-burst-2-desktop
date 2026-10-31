// The map loader's later steps (frame2.js), run for one object made after the level was
// built. Once the map is read, the loader goes over everything it made: it ties each
// attached object to its movable, shows water (water, acid or the map's own colours) and
// widens the area it acts on, gives each visible movable its texture and the two edges
// characters grab. Each step is a loop over every object; its body is read from the
// game's file (like the loader's branches) and run for the one index.
import { game } from '../game/bindings.js';
import { loaderSource, loopAt, runGameCode, GAME_ID as ID } from './loader.js';

let steps = null; // { attach, waterShow, doorTexture, doorEdges, edgeOf, moveAttached }
let stepsFor = null;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The loop around the first place `text` is written whose body passes `test`.
function loopWith(src, text, test = () => true) {
  for (let at = src.indexOf(text); at >= 0; at = src.indexOf(text, at + 1)) {
    const loop = loopAt(src, at);
    if (loop && test(loop.body)) return loop;
  }
  return null;
}

function read(src) {
  const doors = escapeRe(game.codeName('doors'));
  const follows = game.codeName('textureFollows');
  const out = {
    attach: loopWith(src, 'attachments[i].parent='),
    waterShow: loopWith(src, `graphics_3d_front.addChildAt(${game.codeName('waters')}[i],0)`),
    doorTexture: loopWith(src, 'new texture_front0', (body) => body.includes(`${follows}(`)),
    doorEdges: loopWith(src, 'new veh_hh', (body) => new RegExp(`${doors}\\[i\\]`).test(body)),
  };
  // The lists textureFollows keeps: the textures, and the movable each follows.
  const tie = src.match(new RegExp(String.raw`function ${escapeRe(follows)}\(clip,(${ID})\)\s*\{\s*${ID}=(${ID})\.length;\s*\2\[${ID}\]=clip;\s*(${ID})\[${ID}\]=\1;`));
  out.tied = tie ? { clips: tie[2], door: tie[3] } : null;
  out.edgeOf = out.doorEdges?.body.match(new RegExp(String.raw`mc\.(${ID})=i;`))?.[1] || null;
  // A wall's grab points: the loop that makes them, the game's line test it asks
  // whether there is room beside a corner, the function that makes a vehicle of one,
  // and the model it gives it.
  const wallEdges = loopWith(src, 'new veh_hh', (body) => !new RegExp(`${doors}\\[i\\]`).test(body) && /\(mc,n,1\)/.test(body));
  out.wallEdge = wallEdges && {
    clear: wallEdges.body.match(new RegExp(String.raw`if\((${ID})\(`))?.[1],
    make: wallEdges.body.match(new RegExp(String.raw`(${ID})\(mc,n,1\)`))?.[1],
    model: Number(wallEdges.body.match(/n=(\d+);/)?.[1]),
  };
  // The function that moves what is attached to movable i: (i, speed, interpolation).
  out.moveAttached = src.match(new RegExp(String.raw`function (${ID})\(i,${ID},${ID}=0\)\s*\{\s*for\(var (${ID})=0;\2<attachments\.length`))?.[1] || null;
  return out;
}

function stepsNow() {
  const src = loaderSource();
  if (!src) return null;
  if (stepsFor !== src) { steps = read(src); stepsFor = src; }
  return steps;
}

const runStep = (step, i, name) => { if (step) runGameCode(step.body, name, { set: { [step.loopVar]: i } }); return !!step; };

// ----- attachments: { parent, child, type, ... } in the game's global list -----

const list = () => (typeof attachments === 'undefined' ? null : attachments); // eslint-disable-line no-undef

export const attachMark = () => list()?.length ?? 0;

// Takes out of the list the entries that tie what `isOld(entry)` says to its movable.
export function dropAttachments(isOld) {
  const a = list();
  if (!a) return;
  for (let k = a.length - 1; k >= 0; k--) if (isOld(a[k])) a.splice(k, 1);
}

// Entries a branch just added (from `mark` on) name their movable by uid: tied to it as
// the loader ties them. One whose movable the level does not have is taken out.
export function resolveAttachments(mark) {
  const a = list();
  const step = stepsNow()?.attach;
  if (!a || a.length <= mark) return;
  if (!step) { a.splice(mark); throw new Error('the game\'s code that ties objects to movables was not found'); }
  for (let k = mark; k < a.length;) {
    try {
      runStep(step, k, 'attach');
      if (!a[k].parent) throw new Error('no such movable');
      k++;
    } catch {
      a.splice(k, 1);
    }
  }
}

// Entries tied to the movable `from`, tied to `to` instead (a movable made again).
export function moveAttachments(from, to) {
  for (const entry of list() || []) if (entry.parent === from) entry.parent = to;
}

// What is attached to movable i put where the movable now is.
export function followMovable(i) {
  const name = stepsNow()?.moveAttached;
  if (name && typeof globalThis[name] === 'function') globalThis[name](i, 0, 0);
}

// ----- water -----

// Water i shown (when it has friction: water or acid, or the map's own colour) and the
// area it acts on widened, as the loader does once the map is read.
export function showWater(i) {
  if (!runStep(stepsNow()?.waterShow, i, 'water')) throw new Error('the game\'s code that shows water was not found');
}

// ----- movables -----

// The texture of movable i (one is made for a visible movable and follows it), or null.
export function doorTexture(i) {
  const names = stepsNow()?.tied;
  const clips = names && globalThis[names.clips];
  const door = names && globalThis[names.door];
  if (!clips || !door) return null;
  const Texture = game.wallTexture();
  for (let k = clips.length - 1; k >= 0; k--) if (door[k] === i && (!Texture || clips[k] instanceof Texture)) return clips[k];
  return null;
}

// A texture for movable i, as the loader gives a visible one.
export function makeDoorTexture(i) {
  if (!runStep(stepsNow()?.doorTexture, i, 'door-texture')) throw new Error('the game\'s code that gives a movable its texture was not found');
}

// The edges characters grab on movable i (a visible one has two).
export function doorEdges(i) {
  const field = stepsNow()?.edgeOf;
  const g = game.worldLayer();
  if (!field || !g) return [];
  return (g.children || []).filter((c) => c && c[field] === i);
}

export function makeDoorEdges(i) {
  if (!runStep(stepsNow()?.doorEdges, i, 'door-edges')) throw new Error('the game\'s code that gives a movable its edges was not found');
}

// ----- walls: the points characters grab -----

// The loader gives a wall a grab point at each top corner (a "Hand holder" vehicle,
// veh_hh) where there is room beside it: a line from 15 out, 30 above to 75 below
// the corner, and one from 5 in, 5 to 50 above it, cross no wall (frame2.js).
const EDGE_TESTS = Object.freeze([
  [-15, -30, -15, 75],
  [5, -5, 5, -50],
]);
const FAR = 1e7;

function roomAt(clear, x, y, side) {
  return EDGE_TESTS.every(([dx1, dy1, dx2, dy2]) => clear(x + dx1 * side, y + dy1, x + dx2 * side, y + dy2));
}

// The grab points standing at a wall's top corners: { left, right } (null where none).
function edgesAt(r) {
  const Holder = globalThis.veh_hh;
  const world = game.worldLayer();
  const tie = stepsNow()?.edgeOf;
  const out = { left: null, right: null };
  if (!Holder || !world || !r) return out;
  for (const c of world.children || []) {
    if (!(c instanceof Holder) || c.io === false || (tie && c[tie] !== undefined && c[tie] !== -1) || c.y !== r.y) continue;
    if (c.x === r.x && !out.left) out.left = c;
    else if (c.x === r.x + r.w && !out.right) out.right = c;
  }
  return out;
}

const retire = (c) => { if (c) Object.assign(c, { io: false, visible: false, x: FAR, y: FAR }); };

// A wall's grab points after it moved from `from` to `to` (either null: added, or
// taken out): the ones it had go along where there is room, the others are taken out
// of play, and a corner that has room and none gets one, as the loader makes it.
// Returns false when this game version's code for them was not found (the wall's old
// ones are taken out then).
export function placeWallEdges(from, to) {
  const step = stepsNow()?.wallEdge;
  const clear = step?.clear && globalThis[step.clear];
  const make = step?.make && globalThis[step.make];
  const had = edgesAt(from);
  if (!to) { retire(had.left); retire(had.right); return true; }
  if (typeof clear !== 'function' || typeof make !== 'function' || !Number.isFinite(step.model)) {
    retire(had.left); retire(had.right);
    return false;
  }
  const world = game.worldLayer();
  for (const [key, x, side] of [['left', to.x, 1], ['right', to.x + to.w, -1]]) {
    const old = had[key];
    if (!roomAt(clear, x, to.y, side)) { retire(old); continue; }
    if (old) { old.x = x; old.y = to.y; old.clearMCInterpolationData?.(); continue; }
    const mc = world.addChildAt(new globalThis.veh_hh(), world.numChildren);
    game.initDisplay(mc);
    mc.x = x;
    mc.y = to.y;
    make(mc, step.model, side);
  }
  return true;
}
