// Where an element is in the running game, which is not always where the map put it:
// regions ride on the movables they are attached to, and characters walk around.
// Everything else is drawn where the map puts it.
import { game } from '../game/bindings.js';
import { kindOf, boundsOf } from './kinds.js';

// Elements added since the level loaded are not in the game yet: drawn where the map
// puts them.
export function liveBounds(doc, e) {
  const map = boundsOf(e);
  if (!map || !e.live) return map;
  if (e.tag === 'region') {
    const r = e.live.index < game.regionCount() ? game.regions()?.[e.live.index] : null;
    if (r && Number.isFinite(r.x)) return { x: r.x, y: r.y, w: map.w, h: map.h };
  }
  if (e.live.char !== undefined) {
    const c = e.live.char < game.charCount() ? game.chars()?.[e.live.char] : null;
    const box = kindOf(e.tag).box;
    if (c && c.io && Number.isFinite(c.x)) return { x: c.x + box.x, y: c.y + box.y, w: box.w, h: box.h };
  }
  return map;
}
