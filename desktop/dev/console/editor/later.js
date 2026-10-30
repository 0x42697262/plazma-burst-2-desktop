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
