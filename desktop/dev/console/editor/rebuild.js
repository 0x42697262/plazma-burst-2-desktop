// An object of the running level built again by the game's own loader (loader.js),
// for edits nothing finer can put in: a region's activation (its USE switch is drawn
// or taken away), a decoration's model, a movable's settings, a lamp, a pusher, a
// trigger's or timer's uid. The element's branch runs with the kind's counter at its
// index, so the game's arrays get a new object in its place; what the old one put on
// screen is taken off first.
import { game } from '../game/bindings.js';
import { canRebuild, buildElement, loaderProblem } from './loader.js';
import { textureAt } from '../game/walls.js';

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
