// Where an element is in the running game, which is not always where the map put it:
// regions ride on the movables they are attached to, and characters walk around.
// Everything else is drawn where the map puts it.
import { game } from '../game/bindings.js';
import { kindOf, boundsOf } from './kinds.js';

// Players and enemies share the game's characters array, in map order.
const CHAR_TAGS = new Set(['player', 'enemy']);

let indexedDoc = null;
let indexedVersion = -1;
let charIndex = new Map(); // element id -> character index

function charOf(doc, e) {
  if (indexedDoc !== doc || indexedVersion !== doc.version) {
    indexedDoc = doc;
    indexedVersion = doc.version;
    charIndex = new Map();
    let i = 0;
    for (const el of doc.elements) if (CHAR_TAGS.has(el.tag)) charIndex.set(el.id, i++);
  }
  return game.chars()?.[charIndex.get(e.id)];
}

export function liveBounds(doc, e) {
  const map = boundsOf(e);
  if (!map) return null;
  if (e.tag === 'region') {
    const r = game.regions()?.[doc.ordinal(e)];
    if (r && Number.isFinite(r.x)) return { x: r.x, y: r.y, w: map.w, h: map.h };
  }
  if (CHAR_TAGS.has(e.tag)) {
    const c = charOf(doc, e);
    const box = kindOf(e.tag).box;
    if (c && c.io && Number.isFinite(c.x)) return { x: c.x + box.x, y: c.y + box.y, w: box.w, h: box.h };
  }
  return map;
}
