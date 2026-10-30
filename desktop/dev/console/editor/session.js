// The editor's state: whether it is on, the map document, what is selected, which
// layers are hidden. Views (overlay, panels) read it and redraw when `changed` fires;
// nothing here touches the screen.
import { game } from '../game/bindings.js';
import { isActive, requireLevel } from '../game/level.js';
import { MapDoc } from './doc.js';
import { KIND_TAGS, kindOf } from './kinds.js';
import { liveBounds } from './live.js';

const PICK_SLOP = 2; // world units around a thin element that still hit it
const SAME_SPOT = 3; // world units: a click this close to the last one cycles the stack

const listeners = new Set();
const state = {
  on: false,
  doc: null,
  selectedId: null,
  layer: 'region', // the layer the objects list shows
  hidden: new Set(), // tags not drawn and not picked
  lastPick: null, // { at, ids, k }: the stack under the last click, for cycling
};

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const changed = (what) => { for (const fn of listeners) fn(what); };

export const editorOn = () => state.on;
export const editorDoc = () => state.doc;
export const currentLayer = () => state.layer;
export const isHidden = (tag) => state.hidden.has(tag);
export const selected = () => (state.doc && state.selectedId !== null ? state.doc.byId(state.selectedId) : null);

// The map text the game is playing, as a document. Throws when there is none yet.
function readDoc() {
  const doc = MapDoc.of(game.mapText());
  if (!doc) throw new Error('the map text is not readable yet; wait until the level has started');
  return doc;
}

export function setEditor(on) {
  if (on === state.on) return false;
  if (on) {
    requireLevel();
    state.doc = readDoc();
    state.selectedId = null;
  }
  state.on = on;
  state.lastPick = null;
  changed('on');
  return true;
}

export function select(e) {
  const id = e ? e.id : null;
  if (id === state.selectedId) return;
  state.selectedId = id;
  if (e && kindOf(e.tag)) state.layer = e.tag;
  changed('selection');
}

export function showLayer(tag) {
  if (!kindOf(tag)) return;
  state.layer = tag;
  changed('layer');
}

export function setHidden(tag, hidden) {
  if (hidden) state.hidden.add(tag); else state.hidden.delete(tag);
  if (hidden && selected()?.tag === tag) state.selectedId = null;
  changed('layers');
}

// Every element that is drawn: a kind the editor knows, on a shown layer, with a place.
export function* visibleElements() {
  if (!state.doc) return;
  for (const e of state.doc.elements) {
    if (state.hidden.has(e.tag) || !kindOf(e.tag)) continue;
    const b = liveBounds(state.doc, e);
    if (b) yield { e, b };
  }
}

export const countByTag = () => {
  const out = Object.fromEntries(KIND_TAGS.map((t) => [t, 0]));
  for (const e of state.doc?.elements || []) if (e.tag in out) out[e.tag]++;
  return out;
};

const contains = (b, p, slop) => p.x >= b.x - slop && p.x <= b.x + b.w + slop && p.y >= b.y - slop && p.y <= b.y + b.h + slop;

// What a click at world point p selects: the smallest element under it, so a region on
// a wall wins over the wall. Clicking the same spot again takes the next one down the
// stack. Returns the element, or null (which clears the selection).
export function pickAt(p) {
  const hits = [...visibleElements()].filter(({ b }) => contains(b, p, PICK_SLOP))
    .sort((a, z) => a.b.w * a.b.h - z.b.w * z.b.h)
    .map(({ e }) => e.id);
  const last = state.lastPick;
  const again = last && Math.hypot(last.at.x - p.x, last.at.y - p.y) <= SAME_SPOT
    && last.ids.length === hits.length && last.ids.every((id, i) => id === hits[i]);
  const k = again ? (last.k + 1) % hits.length : 0;
  state.lastPick = hits.length ? { at: p, ids: hits, k } : null;
  const e = hits.length ? state.doc.byId(hits[k]) : null;
  select(e);
  return e;
}

// Once per frame: the editor goes off when the level ends, and starts over on a new map
// (or a restart, which loads the map text again).
export function editorTick() {
  if (!state.on) return;
  if (!isActive()) { setEditor(false); return; }
  const text = game.mapText();
  if (text !== state.doc.source) {
    const doc = MapDoc.of(text);
    if (!doc) return;
    state.doc = doc;
    state.selectedId = null;
    state.lastPick = null;
    changed('doc');
  }
}
