// The editor's state: whether it is on, the map document, what is selected, which
// layers can be selected, which edits the running level does not have. Views (overlay,
// panels) read it and redraw when it notifies them; nothing here touches the screen.
// While no level runs (loading, menus) the editor stays on but is not shown.
import { game } from '../game/bindings.js';
import { isActive, requireLevel } from '../game/level.js';
import { MapDoc } from './doc.js';
import { KIND_TAGS, kindOf } from './kinds.js';
import { liveBounds } from './live.js';
import { readLoader, loaderReady } from './loader.js';

const PICK_SLOP = 2; // world units around a thin element that still hit it
const SAME_SPOT = 3; // world units: a click this close to the last one cycles the stack

const listeners = new Set();
const state = {
  on: false,
  shown: false, // on, and a level is running
  pending: new Set(), // ids of elements with edits the running game does not have yet
  doc: null,
  selectedId: null,
  layer: 'region', // the layer the objects list shows
  selectable: new Set(KIND_TAGS), // the active layers: what a click can select (the rest is drawn faint)
  moreLayers: false, // the Layers list shows every kind ("More"), not just the groups
  pick: null, // { kinds, what, onPick(element) }: a parameter waiting for an object clicked in the world
  levelStarts: 0, // level starts seen, editor on or off
  levelRunning: false,
  docLevel: -1, // the level start the running level got the document's edits at
  tool: 'select', // TOOL: what a click in the world does
  preview: null, // { tag, x, y, w, h }: the rectangle being dragged out with the place tool
  lastPick: null, // { at, ids, k }: the stack under the last click, for cycling
};

// select: a click selects, a drag moves or resizes the selection. place: a click (or
// for a rectangle, a drag) adds an element of the layer the objects list shows.
export const TOOL = Object.freeze({ SELECT: 'select', PLACE: 'place' });

export const onChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
// what: 'shown' (on/off or level start/end), 'doc', 'reloaded' (the level started again
// on the same map), 'selection', 'layer', 'layers', 'tool', 'pick', 'edit'.
export const notify = (what) => { for (const fn of listeners) fn(what); };
const changed = notify;

export const editorOn = () => state.on;
export const editorShown = () => state.shown;
export const pendingCount = () => state.pending.size;
export const markPending = (e) => { state.pending.add(e.id); };
export const isPending = (e) => state.pending.has(e.id);
export const editorDoc = () => state.doc;
export const currentLayer = () => state.layer;
export const isSelectable = (tag) => state.selectable.has(tag);
export const selectableLayers = () => [...state.selectable];
export const moreLayers = () => state.moreLayers;
export const currentPick = () => state.pick;

// A parameter that takes an object: until one of `kinds` is clicked in the world (any
// layer, as in the map editor) or Esc, a click picks instead of selecting.
export function startPick(kinds, what, onPick) {
  state.pick = { kinds, what, onPick };
  changed('pick');
}

export function cancelPick() {
  if (!state.pick) return false;
  state.pick = null;
  changed('pick');
  return true;
}

// The object a pick at world point p takes: the one of the kinds whose centre is
// nearest, within `reach`, or one whose box holds p.
export function pickTargetAt(p, reach) {
  if (!state.pick || !state.doc) return null;
  let best = null;
  for (const e of state.doc.elements) {
    if (!state.pick.kinds.includes(e.tag)) continue;
    const b = liveBounds(state.doc, e);
    if (!b) continue;
    const d = Math.hypot(b.x + b.w / 2 - p.x, b.y + b.h / 2 - p.y);
    if ((d <= reach || contains(b, p, 0)) && (!best || d < best.d)) best = { e, d };
  }
  return best && best.e;
}

// Finishes a pick with element e (null: nothing there, keep waiting).
export function finishPick(e) {
  const pick = state.pick;
  if (!pick || !e) return false;
  state.pick = null;
  pick.onPick(e);
  changed('pick');
  return true;
}
export const currentTool = () => state.tool;
export const placePreview = () => state.preview;

export function setTool(tool) {
  if (tool === state.tool) return;
  state.tool = tool;
  state.preview = null;
  changed('tool');
}

export function setPreview(rect) { state.preview = rect; }
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
    // The same map still running: the document goes on, with everything added, deleted
    // and changed. If the level started over meanwhile, the edits go in again.
    const text = game.mapText();
    if (state.doc && state.doc.source === text) {
      if (state.docLevel !== state.levelStarts) { state.docLevel = state.levelStarts; changed('reloaded'); }
    } else {
      takeDoc(readDoc());
    }
    if (!loaderReady()) readLoader(); // the game's loader, for rebuilding objects
  }
  state.on = on;
  setShown(on);
  return true;
}

// Whether the running level has the document's edits: its map, not started over since
// they went in.
export const docInLevel = () => !!state.doc && state.levelRunning && state.doc.source === game.mapText()
  && state.docLevel === state.levelStarts;

// The document read again from the map the game plays (its edits, history and
// pending ones gone); with the editor off, or no map to read, dropped until the next
// "editor on".
export function resetDocument() {
  const doc = state.on ? MapDoc.of(game.mapText()) : null;
  if (doc) { takeDoc(doc); return; }
  state.doc = null;
  state.selectedId = null;
  state.pending.clear();
  changed('doc');
}

// Drops the document (the next "editor on" reads the map again). For tests.
export function forgetDocument() { if (!state.on) { state.doc = null; state.selectedId = null; } }

function setShown(shown) {
  if (shown === state.shown) return;
  state.shown = shown;
  state.lastPick = null;
  changed('shown');
}

// A new document: nothing selected, pending or undoable (edit.js clears its history on
// 'doc').
function takeDoc(doc) {
  state.doc = doc;
  state.docLevel = state.levelStarts;
  state.selectedId = null;
  state.lastPick = null;
  state.pending.clear();
  changed('doc');
}

export function select(e) {
  const id = e ? e.id : null;
  if (id === state.selectedId) return;
  state.selectedId = id;
  state.pick = null;
  if (e && kindOf(e.tag)) state.layer = e.tag;
  changed('selection');
}

export function showLayer(tag) {
  if (!kindOf(tag)) return;
  state.layer = tag;
  changed('layer');
}

// The map editor's layer groups ("Layers:" in its left panel).
export const LAYER_GROUPS = Object.freeze({
  statics: ['bg', 'box', 'lamp', 'water', 'pushf'],
  logics: ['trigger', 'timer', 'inf', 'region', 'door', 'pushf'],
  entities: ['player', 'enemy', 'vehicle', 'decor', 'gun', 'barrel', 'inf'],
});

// The active layers: only these kinds can be selected. A selection on a layer that is
// no longer active is let go, as in the map editor.
export function setSelectable(tags) {
  state.selectable = new Set(tags.filter((t) => kindOf(t)));
  if (selected() && !state.selectable.has(selected().tag)) state.selectedId = null;
  state.lastPick = null;
  changed('layers');
}

export function setMoreLayers(on) {
  state.moreLayers = on;
  changed('layers');
}

// Every element that is drawn: a kind the editor knows, with a place, and whether it is
// on an active layer.
export function* visibleElements() {
  if (!state.doc) return;
  for (const e of state.doc.elements) {
    if (!kindOf(e.tag)) continue;
    const b = liveBounds(state.doc, e);
    if (b) yield { e, b, selectable: state.selectable.has(e.tag) };
  }
}

export const countByTag = () => {
  const out = Object.fromEntries(KIND_TAGS.map((t) => [t, 0]));
  for (const e of state.doc?.elements || []) if (e.tag in out) out[e.tag]++;
  return out;
};

const contains = (b, p, slop) => p.x >= b.x - slop && p.x <= b.x + b.w + slop && p.y >= b.y - slop && p.y <= b.y + b.h + slop;

// The elements under world point p, smallest first, so a region on a wall comes before
// the wall.
function hitsAt(p) {
  return [...visibleElements()].filter(({ b, selectable }) => selectable && contains(b, p, PICK_SLOP))
    .sort((a, z) => a.b.w * a.b.h - z.b.w * z.b.h)
    .map(({ e }) => e);
}

// The element a press at p grabs: the smallest one under it, or null. Nothing changes.
export const elementAt = (p) => hitsAt(p)[0] || null;

// What a click at world point p selects: the smallest element under it, so a region on
// a wall wins over the wall. Clicking the same spot again takes the next one down the
// stack. Returns the element, or null (which clears the selection).
export function pickAt(p) {
  const hits = hitsAt(p).map((e) => e.id);
  const last = state.lastPick;
  const again = last && Math.hypot(last.at.x - p.x, last.at.y - p.y) <= SAME_SPOT
    && last.ids.length === hits.length && last.ids.every((id, i) => id === hits[i]);
  const k = again ? (last.k + 1) % hits.length : 0;
  state.lastPick = hits.length ? { at: p, ids: hits, k } : null;
  const e = hits.length ? state.doc.byId(hits[k]) : null;
  select(e);
  return e;
}

// Once per frame. The editor hides while no level runs and shows again with the next
// one. A level that starts on the same map (a restart, dying, a new round) gets the
// edits again; any other map starts a new document.
export function editorTick() {
  const active = isActive();
  if (active && !state.levelRunning) state.levelStarts++;
  state.levelRunning = active;
  if (!state.on) return;
  if (active === state.shown) return;
  if (active) {
    const text = game.mapText();
    if (text !== state.doc.source) {
      const doc = MapDoc.of(text);
      if (!doc) return; // not readable yet: try next frame
      takeDoc(doc);
    } else {
      state.docLevel = state.levelStarts;
      changed('reloaded'); // the same map again: edit.js puts the edits back in
    }
  }
  setShown(active);
}
