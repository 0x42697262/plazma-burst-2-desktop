// Objects of the running level made, made again and taken out, with the game's own
// loader (loader.js) wherever it can.
// Built again, for edits nothing finer can put in: a region's activation (its USE switch is drawn
// or taken away), a decoration's model, a movable's settings, water's kind, what an
// object is attached to, a trigger's or timer's uid (lamps have lamps.js). The element's
// branch runs with the kind's counter at its index, so the game's arrays get a new
// object in its place; what the old one put on screen is taken off first, and the
// loader's later steps run for the new one (later.js).
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';
import { canRebuild, canBuild, buildElement, builtCount, loaderProblem } from './loader.js';
import { textureAt, addWall, removeWall } from '../../../../src/console/kernel/game/walls.ts';
import { findRect, moveRect } from '../../../../src/console/kernel/game/layers.ts';
import { boundsOf } from './kinds.js';
import { unwrap } from '../../../../src/features/triggers/run-log.ts';
import { claimNewestGun, removeGun, remakeGun } from './guns.js';
import { placeLamp, removeLamp } from './lamps.js';
import { setStart } from './start.js';
import {
  attachMark, dropAttachments, resolveAttachments, moveAttachments, followMovable,
  showWater, doorTexture, makeDoorTexture, doorEdges, makeDoorEdges, placeWallEdges,
} from './later.js';

const detach = (shown) => { if (shown && shown.parent && shown.parent.removeChild) shown.parent.removeChild(shown); };

// For each kind built in place: the old object, what of it to take off the screen before
// the new one is made, which entries of the game's attachments list are the old one's
// (an attached object is tied to its movable once, after the map is read: the new one is
// tied again, later.js), and the loader's later steps for the new one. Kinds not here are
// not rebuilt (walls and backgrounds draw into shared layers; barrels, vehicles and guns
// have no place of their own to rebuild into; lamps have lamps.js).
const IN_PLACE = Object.freeze({
  region: { old: (i) => game.regions()?.[i], drop: (r) => detach(r?.mc), tied: (a, r) => !!r && (a.child === r || (!!r.mc && a.child === r.mc)) },
  decor: { old: (i) => game.decors()?.[i], drop: detach, tied: (a, mc) => !!mc && a.child === mc },
  door: { old: (i) => game.doors()?.[i], drop: detach, tied: (a, mc) => !!mc && a.child === mc, after: doorAfter },
  trigger: { old: () => null, drop: () => {} },
  timer: { old: () => null, drop: () => {} },
  pushf: { old: () => null, drop: () => {}, tied: (a, old, i) => a.type === PUSHER_TIE && a.child === i },
  water: { old: (i) => game.waters().shown?.[i], drop: detach, tied: (a, old, i) => a.type === WATER_TIE && a.id === i, after: (i) => showWater(i) },
});
// The attachment types the loader gives pushers and water (frame2.js): tied by index.
const PUSHER_TIE = 3, WATER_TIE = 5;

// A movable made again (or added): what was tied to the old one is tied to it, a visible
// one has its texture (the old one's, or one made as the loader makes it) and the two
// edges characters grab, and what is attached to it is put where it is.
function doorAfter(i, attrs, { old = null, texture = null, edges = [] } = {}) {
  const now = game.doors()?.[i];
  if (!now) return;
  if (old) moveAttachments(old, now);
  if (attrs.vis === 'true') {
    if (texture) {
      const layer = game.wallLayer();
      if (!texture.parent && layer) layer.addChildAt(texture, layer.numChildren);
      Object.assign(texture, { x: now.x, y: now.y, scaleX: now.scaleX, scaleY: now.scaleY });
    } else makeDoorTexture(i);
    if (!edges.length) makeDoorEdges(i);
  } else if (texture) detach(texture);
  followMovable(i);
}

export const rebuildable = (tag) => !!IN_PLACE[tag];

// Builds element e again at its index in the running level. Throws with the reason
// when it cannot.
export function rebuildLive(e) {
  const kind = IN_PLACE[e.tag];
  if (!kind) throw new Error('the running level cannot take it');
  if (!canRebuild(e.tag)) throw new Error(loaderProblem() || `the game's loader cannot build a ${e.tag} again`);
  const i = e.live.index;
  const old = kind.old(i);
  const was = e.tag === 'door' ? { old, texture: doorTexture(i) ?? (old ? textureAt({ x: old.x, y: old.y, w: old.w, h: old.h }) : null), edges: doorEdges(i) } : { old };
  kind.drop(old);
  if (kind.tied) dropAttachments((a) => kind.tied(a, old, i));
  const mark = attachMark();
  buildElement(e.tag, e.attrs, i);
  resolveAttachments(mark);
  kind.after?.(i, e.attrs, was);
}

// ----- adding -----

// Kinds that cannot be added to a running level, and why.
const NOT_ADDED = Object.freeze({
  player: 'characters are made when the level starts', enemy: 'characters are made when the level starts',
  inf: 'engine marks are read when the level starts', song: 'songs are read when the level starts',
});

// Adds element e to the running level. Returns e.live for it ({ index } when its kind
// keeps one, {} when it does not; problem: what of the loader's later steps failed), or
// throws why it cannot be added.
export function addLive(e) {
  if (NOT_ADDED[e.tag]) throw new Error(NOT_ADDED[e.tag]);
  if (e.tag === 'box') {
    const r = boundsOf(e);
    const index = addWall(r, e.attrs.m ?? '0');
    return placeWallEdges(null, r) ? { index } : { index, problem: 'the game\'s code that gives walls their grab points was not found' };
  }
  if (e.tag === 'lamp') { const index = builtCount('lamp'); placeLamp(e); return { index }; }
  if (!canBuild(e.tag)) throw new Error(loaderProblem() || `the game's loader has no ${e.tag}`);
  const index = builtCount(e.tag);
  const mark = attachMark();
  buildElement(e.tag, e.attrs, index ?? 0);
  // It is in the level now: a later step that fails is said (live.problem), not undone.
  const live = {};
  try {
    resolveAttachments(mark);
    if (e.tag === 'gun') claimNewestGun(e); // edited later through guns.js
    // Barrels and vehicles (no index) are made by the game's own helpers: no place of ours to edit later.
    else if (index !== null) { live.index = index; IN_PLACE[e.tag]?.after?.(index, e.attrs); }
  } catch (err) {
    live.problem = err.message;
  }
  return live;
}

// ----- taking out -----

const FAR = 1e7; // a place nothing reaches
const hide = (shown) => { detach(shown); };

// For each kind: how to take object i out of play without moving the others (the
// game's arrays keep their order).
const REMOVE = Object.freeze({
  box: (i) => {
    const w = game.walls();
    placeWallEdges({ x: w.x[i], y: w.y[i], w: w.w[i], h: w.h[i] }, null);
    removeWall(i);
  },
  region: (i) => { const r = game.regions()[i]; detach(r.mc); r.mc = undefined; r.x = r.y = FAR; r[GAME_FIELDS.R_USE_ON] = 0; },
  trigger: (i) => { const t = unwrap(game.triggers()[i]); t[GAME_FIELDS.T_ENABLED] = false; t[GAME_FIELDS.T_CALLS] = t[GAME_FIELDS.T_MAX_CALLS] = 0; setStart('trigger', t, 'enabled', false); },
  timer: (i) => { const t = game.timers()[i]; t[GAME_FIELDS.T_ENABLED] = false; t[GAME_FIELDS.T_CALLS] = t[GAME_FIELDS.T_MAX_CALLS] = 0; setStart('timer', t, 'enabled', false); },
  decor: (i) => hide(game.decors()[i]),
  door: (i) => {
    const d = game.doors()[i];
    const texture = doorTexture(i) ?? textureAt({ x: d.x, y: d.y, w: d.w, h: d.h });
    if (texture) Object.assign(texture, { scaleX: 0, scaleY: 0 });
    hide(d);
    d.x = d.y = FAR; d.tarx = d.tary = FAR;
  },
  bg: (i) => {
    const bg = game.backgrounds();
    const drawn = findRect({ x: bg.x[i], y: bg.y[i], w: bg.w[i], h: bg.h[i] });
    if (drawn) moveRect(drawn, { x: bg.x[i], y: bg.y[i], w: 0, h: 0 });
    bg.w[i] = 0; bg.h[i] = 0;
  },
  water: (i) => { const w = game.waters(); hide(w.shown?.[i]); w.w[i] = 0; w.h[i] = 0; },
  pushf: (i) => { const p = game.pushers(); p.x2[i] = p.x1[i]; p.y2[i] = p.y1[i]; },
  gun: (i, e) => removeGun(e),
  lamp: (i, e) => removeLamp(e),
});

// Takes element e out of the running level, or throws why it cannot.
export function removeLive(e) {
  const remove = REMOVE[e.tag];
  if (!remove || !e.live || (e.live.index === undefined && e.tag !== 'gun')) throw new Error(`a ${e.tag} cannot be taken out of a running level`);
  remove(e.live.index, e);
}

// Puts a deleted element back (undo of a delete): built again in its place where the
// game's loader can, or throws why not.
export function restoreLive(e) {
  if (e.tag === 'gun' && e.live) { remakeGun(e); return; } // a new one where the old one lies
  if (e.tag === 'lamp' && e.live) { placeLamp(e); return; }
  if (!e.live || e.live.index === undefined) throw new Error('it is not in the running level');
  if (rebuildable(e.tag)) { rebuildLive(e); return; }
  throw new Error(`a deleted ${e.tag} only comes back when the level loads again`);
}
