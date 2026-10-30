// Changing the map: attributes, an element's place and size, adding and deleting
// elements, undo and redo. Each change goes into the document, then into the running
// game where it can (apply.js); everything else is pending until a reload. Every change
// is recorded for undo (history.js).
// Single-player: the game's map text follows the document, so a reload, a restart or
// dying plays the edited map. Multiplayer: the match's map text is left alone (the
// server restarts rounds from its own copy); what is not live stays in the document,
// for "editor save".
import { game } from '../game/bindings.js';
import { ROUTE } from '../core/shared.js';
import { kindOf, SHAPE, DEFAULTS, newUid } from './kinds.js';
import { applyLive } from './apply.js';
import { newElement } from './doc.js';
import { record, takeUndo, takeRedo, clearHistory } from './history.js';
import { F } from '../game/fields.js';
import { player } from '../game/level.js';
import { movePlayerTo } from '../game/teleport.js';
import { editorDoc, notify, markPending, onChange, select, selected, pendingCount, isPressing, editorShown } from './session.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';

const NAME = /^[A-Za-z0-9_]+$/;
const NUMBER_ATTRS = new Set(['x', 'y', 'w', 'h', 'tox', 'toy']);
const LEVEL_RESTART = 'restart';
const SAVE_NAME = /^[A-Za-z0-9 _.-]{1,60}$/;
const DUPLICATE_OFFSET = 20; // a copy lands this far right of and below the original
const NEW_RECT = 100; // the size of a rectangle placed with a click instead of a drag
const AUTO_RELOAD_MS = 700; // editor_autoreload waits this long after the last edit

const tidy = (n) => String(Math.round(n * 100) / 100);

function checkValue(attr, value) {
  if (!NAME.test(attr)) throw new Error(`"${attr}" is not an attribute name (letters, digits, _)`);
  if (value.includes('"')) throw new Error('a map value cannot contain a double quote');
  if (NUMBER_ATTRS.has(attr) && !Number.isFinite(Number(value))) throw new Error(`${attr} must be a number`);
}

// Single-player: the game reads this text whenever the level loads again. With
// editor_autoreload on, an edit the level does not have yet reloads it a moment later.
function syncMapText(doc) {
  if (game.isMP()) return;
  const text = doc.toText();
  doc.source = text;
  game.setMapText(text);
  scheduleReload();
}

// Waits until the edits stop (and the mouse is up, and nothing is being typed in) for
// AUTO_RELOAD_MS, then reloads.
let reloadTimer = null;
function scheduleReload() {
  if (!settings.effective(KEY.EDITOR_AUTORELOAD) || !pendingCount()) return;
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(autoReload, AUTO_RELOAD_MS);
}
function autoReload() {
  reloadTimer = null;
  if (!settings.effective(KEY.EDITOR_AUTORELOAD) || !pendingCount() || !editorShown() || game.isMP()) return;
  const typing = globalThis.document?.activeElement?.tagName === 'INPUT';
  if (isPressing() || typing) { reloadTimer = setTimeout(autoReload, AUTO_RELOAD_MS); return; }
  reloadLevel();
}

// The attributes changed together, e.g. x and y of a move (undefined removes one).
// Returns whether all of them are live in the game now.
function change(e, values, { recorded = true } = {}) {
  const doc = editorDoc();
  for (const [attr, raw] of Object.entries(values)) if (raw !== undefined) checkValue(attr, String(raw));
  let live = true;
  const before = {};
  const after = {};
  for (const [attr, raw] of Object.entries(values)) {
    const old = e.attrs[attr];
    if (!doc.set(e, attr, raw === undefined ? undefined : String(raw))) continue;
    before[attr] = old;
    after[attr] = e.attrs[attr];
    if (!applyLive(e, attr)) { live = false; markPending(e); }
  }
  if (!Object.keys(after).length && !Object.keys(before).length) return { changed: false, live: true };
  if (recorded) record({ kind: 'attrs', e, before, after });
  syncMapText(doc);
  notify('edit');
  return { changed: true, live };
}

// Adding and taking out: the running game has neither until a reload.
function insert(e, at, { recorded = true } = {}) {
  const doc = editorDoc();
  const where = doc.insert(e, at);
  markPending(e);
  if (recorded) record({ kind: 'insert', e, at: where });
  syncMapText(doc);
  notify('edit');
}

function remove(e, { recorded = true } = {}) {
  const doc = editorDoc();
  const at = doc.remove(e);
  if (at < 0) return;
  if (e.live) markPending(e);
  if (selected() === e) select(null);
  if (recorded) record({ kind: 'remove', e, at });
  syncMapText(doc);
  notify('edit');
}

export const setAttr = (e, attr, value) => change(e, { [attr]: value });

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

// Where you stood when you reloaded: you are put back there once the level runs again,
// so building goes on where it was.
let returnTo = null;

function yourSpot() {
  const p = player();
  const ref = p && p[F.REF_PT];
  const x = p && game.ptX()?.[ref];
  const y = p && game.ptY()?.[ref];
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

onChange((what) => {
  if (what === 'doc') { returnTo = null; clearHistory(); } // another map: its own history
  if (what !== 'reloaded' || !returnTo) return;
  const spot = returnTo;
  returnTo = null;
  try { movePlayerTo(spot.x, spot.y, { effect: false }); } catch {}
});

// Single-player: plays the level again from the edited map, the way the game restarts
// it. Everything in the level starts over, and you are put back where you stood.
export function reloadLevel() {
  if (game.isMP()) throw new Error('multiplayer: the server decides when the level loads; edits that are not live stay in the editor for "editor save"');
  returnTo = yourSpot();
  syncMapText(editorDoc());
  game.setLevelState(LEVEL_RESTART);
  const fade = game.fadeOverlay();
  if (fade) { fade.visible = true; fade.alpha = 1; }
}

// desktop/maps/<name>.xml, played as local-<name>. Resolves to the file it wrote.
export async function saveMap(name, { overwrite = false } = {}) {
  if (!SAVE_NAME.test(name)) throw new Error('a map name is letters, digits, spaces, _ . - (up to 60)');
  const url = `${ROUTE.saveEdited}?name=${encodeURIComponent(name)}${overwrite ? '&overwrite=1' : ''}`;
  const r = await fetch(url, { method: 'POST', body: editorDoc().toText() });
  const text = await r.text();
  if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  return JSON.parse(text);
}
