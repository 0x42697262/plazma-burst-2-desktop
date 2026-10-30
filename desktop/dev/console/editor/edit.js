// Changing the map: attributes, an element's place and size, adding and deleting
// elements, undo and redo. Each change goes into the document, then into the running
// level (apply.js); what the running level cannot take stays in the document, for
// "editor save". Every change is recorded for undo (history.js).
// The same in every mode: the game's map text is never written. When the level starts
// again on the same map (dying, a restart, a new round), the game builds it from that
// text, and the edits are put into the new level again.
import { ROUTE } from '../core/shared.js';
import { kindOf, SHAPE, DEFAULTS, newUid } from './kinds.js';
import { applyLive } from './apply.js';
import { addLive, removeLive, restoreLive } from './rebuild.js';
import { forgetGuns } from './guns.js';
import { forgetLamps } from './lamps.js';
import { MapDoc, newElement } from './doc.js';
import { record, takeUndo, takeRedo, clearHistory } from './history.js';
import { editorDoc, notify, markPending, onChange, select, selected } from './session.js';

const NAME = /^[A-Za-z0-9_]+$/;
const NUMBER_ATTRS = new Set(['x', 'y', 'w', 'h', 'tox', 'toy']);
const SAVE_NAME = /^[A-Za-z0-9 _.-]{1,60}$/;
const DUPLICATE_OFFSET = 20; // a copy lands this far right of and below the original
const NEW_RECT = 100; // the size of a rectangle placed with a click instead of a drag

const tidy = (n) => String(Math.round(n * 100) / 100);

function checkValue(attr, value) {
  if (!NAME.test(attr)) throw new Error(`"${attr}" is not an attribute name (letters, digits, _)`);
  if (value.includes('"')) throw new Error('a map value cannot contain a double quote');
  if (NUMBER_ATTRS.has(attr) && !Number.isFinite(Number(value))) throw new Error(`${attr} must be a number`);
}

// The attributes changed together, e.g. x and y of a move (undefined removes one).
// Returns whether all of them are live in the game now.
function change(e, values, { recorded = true } = {}) {
  const doc = editorDoc();
  for (const [attr, raw] of Object.entries(values)) if (raw !== undefined) checkValue(attr, String(raw));
  let live = true;
  let why = '';
  const before = {};
  const after = {};
  for (const [attr, raw] of Object.entries(values)) {
    const old = e.attrs[attr];
    if (!doc.set(e, attr, raw === undefined ? undefined : String(raw))) continue;
    before[attr] = old;
    after[attr] = e.attrs[attr];
    const applied = applyLive(e, attr);
    if (!applied.live) { live = false; why ||= applied.why; markPending(e); }
  }
  if (!Object.keys(after).length && !Object.keys(before).length) return { changed: false, live: true };
  if (recorded) record({ kind: 'attrs', e, before, after });
  lastWhy = live ? '' : why;
  notify('edit');
  return { changed: true, live, why };
}

// Why the last edit was not live, for the status line ('' when it was).
let lastWhy = '';
export const notLiveReason = () => lastWhy;

// Adding and taking out, in the running level too (rebuild.js): a new object is made
// with the game's loader, a deleted one is taken out of play, and an undone delete is
// built again. What the level cannot take is kept for "editor save" and says why.
function insert(e, at, { recorded = true } = {}) {
  const doc = editorDoc();
  const where = doc.insert(e, at);
  try {
    if (e.live) { restoreLive(e); takenOut.delete(e); } else e.live = addLive(e);
    lastWhy = '';
  } catch (err) { markPending(e); lastWhy = err.message; }
  if (recorded) record({ kind: 'insert', e, at: where });
  notify('edit');
}

// Objects taken out of the running level, to take out again when it starts over.
const takenOut = new Set();

function remove(e, { recorded = true } = {}) {
  const doc = editorDoc();
  const at = doc.remove(e);
  if (at < 0) return;
  if (e.live) {
    try { removeLive(e); takenOut.add(e); lastWhy = ''; } catch (err) { markPending(e); lastWhy = err.message; }
  }
  if (selected() === e) select(null);
  if (recorded) record({ kind: 'remove', e, at });
  notify('edit');
}

export const setAttr = (e, attr, value) => change(e, { [attr]: value });
// Several attributes at once (undefined removes one): one step for undo.
export const setAttrs = (e, values) => change(e, values);

// A rectangle's place and size, or a point's place (w and h ignored).
export function setPlace(e, { x, y, w, h }) {
  const values = { x: tidy(x), y: tidy(y) };
  if (kindOf(e.tag)?.shape === SHAPE.RECT) Object.assign(values, { w: tidy(w), h: tidy(h) });
  return change(e, values);
}

// A new element of a kind at a place (a rectangle's w and h, or NEW_RECT), with the map
// editor's defaults and a fresh uid. It is selected.
export function addElement(tag, { x, y, w = NEW_RECT, h = NEW_RECT }) {
  const kind = kindOf(tag);
  if (!kind) throw new Error(`cannot add a "${tag}"`);
  const uid = newUid(editorDoc(), tag);
  const place = kind.shape === SHAPE.RECT ? { x: tidy(x), y: tidy(y), w: tidy(w), h: tidy(h) } : { x: tidy(x), y: tidy(y) };
  const e = newElement(tag, { ...(uid ? { uid } : {}), ...place, ...DEFAULTS[tag] });
  insert(e);
  select(e);
  return e;
}

export function deleteElement(e) { remove(e); }

// A copy next to the original, with a uid of its own when it has one. It is selected.
export function duplicateElement(e) {
  const attrs = { ...e.attrs, x: tidy(Number(e.attrs.x) + DUPLICATE_OFFSET), y: tidy(Number(e.attrs.y) + DUPLICATE_OFFSET) };
  if (attrs.uid) attrs.uid = newUid(editorDoc(), e.tag);
  const copy = newElement(e.tag, attrs);
  insert(copy);
  select(copy);
  return copy;
}

// Plays an entry back, forwards (redo) or backwards (undo), without recording it again.
function play(entry, backwards) {
  const steps = backwards ? [...entry].reverse() : entry;
  for (const step of steps) {
    const quiet = { recorded: false };
    if (step.kind === 'attrs') change(step.e, backwards ? step.before : step.after, quiet);
    else if ((step.kind === 'insert') !== backwards) insert(step.e, step.at, quiet);
    else remove(step.e, quiet);
  }
  const last = steps[steps.length - 1];
  const gone = (last.kind === 'insert') === backwards;
  select(gone ? null : last.e);
}

// Each returns false when there is nothing to undo or redo.
export function undo() { const entry = takeUndo(); if (entry) play(entry, true); return !!entry; }
export function redo() { const entry = takeRedo(); if (entry) play(entry, false); return !!entry; }

// The level started again from the map text: it is the map as it loaded, without the
// edits. Every attribute of an element the game has that differs from the map is put in
// again, the way the edit put it in the first time; what was taken out is taken out
// again, and what was added is added again, in the order it was added.
function replayEdits() {
  const doc = editorDoc();
  const original = MapDoc.of(doc.source);
  if (!original) return;
  const byIndex = new Map(); // "tag#index" -> the element as the map has it
  for (const e of original.elements) byIndex.set(`${e.tag}#${e.live.index}`, e);
  const added = [];
  for (const e of doc.elements) {
    if (!e.live || e.live.index === undefined) continue;
    const was = byIndex.get(`${e.tag}#${e.live.index}`);
    if (!was) { added.push(e); continue; }
    for (const attr of new Set([...Object.keys(e.attrs), ...Object.keys(was.attrs)])) {
      if (e.attrs[attr] !== was.attrs[attr] && !applyLive(e, attr).live) markPending(e);
    }
  }
  for (const e of takenOut) { try { removeLive(e); } catch { markPending(e); } }
  for (const e of added.sort((x, y) => x.live.index - y.live.index)) {
    try { e.live = addLive(e); } catch { markPending(e); }
  }
}

onChange((what) => {
  if (what === 'doc') { clearHistory(); takenOut.clear(); forgetGuns(); forgetLamps(); } // another map: its own history
  if (what === 'reloaded') { forgetGuns(); forgetLamps(); replayEdits(); }
});

// desktop/maps/<name>.xml, played as local-<name>. Resolves to the file it wrote.
export async function saveMap(name, { overwrite = false } = {}) {
  if (!SAVE_NAME.test(name)) throw new Error('a map name is letters, digits, spaces, _ . - (up to 60)');
  const url = `${ROUTE.saveEdited}?name=${encodeURIComponent(name)}${overwrite ? '&overwrite=1' : ''}`;
  const r = await fetch(url, { method: 'POST', body: editorDoc().toText() });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  return JSON.parse(text);
}
