// Objects of the running level made, made again and taken out, with the game's own
// loader (loader.js) wherever it can.
// Built again, for edits nothing finer can put in: a region's activation (its USE switch is drawn
// or taken away), a decoration's model, a movable's settings, a lamp, a pusher, a
// trigger's or timer's uid. The element's branch runs with the kind's counter at its
// index, so the game's arrays get a new object in its place; what the old one put on
// screen is taken off first.
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { canRebuild, canBuild, buildElement, builtCount, loaderProblem } from './loader.js';
import { textureAt, addWall, removeWall } from '../game/walls.js';
import { findRect, moveRect } from '../game/layers.js';
import { boundsOf } from './kinds.js';
import { unwrap } from '../triggers/log.js';
import { claimNewestGun, removeGun, remakeGun } from './guns.js';

const detach = (shown) => { if (shown && shown.parent && shown.parent.removeChild) shown.parent.removeChild(shown); };

// For each kind built in place: the old object, and what of it to take off the screen
// before the new one is made. Kinds not here are not rebuilt (walls, backgrounds and
// water draw into shared layers or later steps of the loader; barrels, vehicles and
// guns have no place of their own to rebuild into).
const IN_PLACE = Object.freeze({
  region: { old: (i) => game.regions()?.[i], drop: (r) => detach(r?.mc) },
  decor: { old: (i) => game.decors()?.[i], drop: detach },
  door: { old: (i) => game.doors()?.[i], drop: detach },
  trigger: { old: () => null, drop: () => {} },
  timer: { old: () => null, drop: () => {} },
  lamp: { old: () => null, drop: () => {} },
  pushf: { old: () => null, drop: () => {} },
});

export const rebuildable = (tag) => !!IN_PLACE[tag];

// Builds element e again at its index in the running level. Throws with the reason
// when it cannot.
export function rebuildLive(e) {
  const kind = IN_PLACE[e.tag];
  if (!kind) throw new Error('the running level cannot take it');
  if (!canRebuild(e.tag)) throw new Error(loaderProblem() || `the game's loader cannot build a ${e.tag} again`);
  const i = e.live.index;
  const old = kind.old(i);
  // A visible movable's texture follows it by index; its size is the old one's.
  const body = e.tag === 'door' && old ? textureAt({ x: old.x, y: old.y, w: old.w, h: old.h }) : null;
  kind.drop(old);
  buildElement(e.tag, e.attrs, i);
  const now = e.tag === 'door' ? game.doors()?.[i] : null;
  if (body && now) Object.assign(body, { scaleX: now.w / 100, scaleY: now.h / 100 });
}

// ----- adding -----

// The loader's later steps for a kind, after its branch made the object at index i.
const AFTER_BUILD = Object.freeze({
  // A visible movable's texture, as the loader makes it once the map is read.
  door: (i, attrs) => {
    const door = game.doors()?.[i];
    const layer = game.wallLayer();
    const Texture = game.wallTexture();
    if (!door || attrs.vis !== 'true' || !layer || !Texture) return;
    const texture = layer.addChildAt(new Texture(), layer.numChildren);
    game.initDisplay(texture);
    Object.assign(texture, { x: door.x, y: door.y, scaleX: door.scaleX, scaleY: door.scaleY });
    game.textureFollows(texture, i);
  },
  // Water is shown at the map's place and acts on an area 10 wider on each side and 10
  // lower, as the loader sets them once the map is read.
  water: (i, attrs) => {
    const w = game.waters();
    const shown = w.shown?.[i];
    const front = game.frontLayer();
    if (shown && front && attrs.friction !== 'false' && attrs.friction !== '0') {
      front.addChildAt(shown, 0);
      game.initDisplay(shown);
      Object.assign(shown, { x: w.x[i], y: w.y[i], scaleX: w.w[i] / 100, scaleY: w.h[i] / 100 });
      shown.gotoAndStop?.(Number(attrs.damage) > 0 ? 1 : 2);
    }
    w.x[i] -= 10; w.w[i] += 20; w.h[i] += 10;
  },
});

// Kinds that cannot be added to a running level, and why.
const NOT_ADDED = Object.freeze({
  player: 'characters are made when the level starts', enemy: 'characters are made when the level starts',
  inf: 'engine marks are read when the level starts', song: 'songs are read when the level starts',
});

// Adds element e to the running level. Returns e.live for it ({ index } when its kind
// keeps one, {} when it does not), or throws why it cannot be added.
export function addLive(e) {
  if (NOT_ADDED[e.tag]) throw new Error(NOT_ADDED[e.tag]);
  if (e.tag === 'box') return { index: addWall(boundsOf(e), e.attrs.m ?? '0') };
  if (!canBuild(e.tag)) throw new Error(loaderProblem() || `the game's loader has no ${e.tag}`);
  const index = builtCount(e.tag);
  buildElement(e.tag, e.attrs, index ?? 0);
  if (e.tag === 'gun') { claimNewestGun(e); return {}; } // edited later through guns.js
  if (index === null) return {}; // barrels, vehicles: made by the game's own helpers, no place of ours to edit later
  AFTER_BUILD[e.tag]?.(index, e.attrs);
  return { index };
}

// ----- taking out -----

const FAR = 1e7; // a place nothing reaches
const hide = (shown) => { detach(shown); };

// For each kind: how to take object i out of play without moving the others (the
// game's arrays keep their order).
const REMOVE = Object.freeze({
  box: (i) => removeWall(i),
  region: (i) => { const r = game.regions()[i]; detach(r.mc); r.mc = undefined; r.x = r.y = FAR; r[F.R_USE_ON] = 0; },
  trigger: (i) => { const t = unwrap(game.triggers()[i]); t[F.T_ENABLED] = false; t[F.T_CALLS] = 0; },
  timer: (i) => { const t = game.timers()[i]; t[F.T_ENABLED] = false; t[F.T_CALLS] = 0; },
  decor: (i) => hide(game.decors()[i]),
  door: (i) => {
    const d = game.doors()[i];
    const texture = textureAt({ x: d.x, y: d.y, w: d.w, h: d.h });
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
  if (!e.live || e.live.index === undefined) throw new Error('it is not in the running level');
  if (rebuildable(e.tag)) { rebuildLive(e); return; }
  throw new Error(`a deleted ${e.tag} only comes back when the level loads again`);
}
