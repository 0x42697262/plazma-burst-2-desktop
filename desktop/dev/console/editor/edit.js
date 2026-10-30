// Changing the map: one attribute at a time, or an element's place and size. Each change
// goes into the document, then into the running game where it can (apply.js).
// Single-player: the game's map text follows the document, so a reload, a restart or
// dying plays the edited map. Multiplayer: the match's map text is left alone (the
// server restarts rounds from its own copy); what is not live stays in the document,
// for "editor save".
import { game } from '../game/bindings.js';
import { ROUTE } from '../core/shared.js';
import { kindOf, SHAPE } from './kinds.js';
import { applyLive } from './apply.js';
import { F } from '../game/fields.js';
import { player } from '../game/level.js';
import { movePlayerTo } from '../game/teleport.js';
import { editorDoc, notify, markPending, onChange } from './session.js';

const NAME = /^[A-Za-z0-9_]+$/;
const NUMBER_ATTRS = new Set(['x', 'y', 'w', 'h', 'tox', 'toy']);
const LEVEL_RESTART = 'restart';
const SAVE_NAME = /^[A-Za-z0-9 _.-]{1,60}$/;

const tidy = (n) => String(Math.round(n * 100) / 100);

function checkValue(attr, value) {
  if (!NAME.test(attr)) throw new Error(`"${attr}" is not an attribute name (letters, digits, _)`);
  if (value.includes('"')) throw new Error('a map value cannot contain a double quote');
  if (NUMBER_ATTRS.has(attr) && !Number.isFinite(Number(value))) throw new Error(`${attr} must be a number`);
}

// Single-player: the game reads this text whenever the level loads again.
function syncMapText(doc) {
  if (game.isMP()) return;
  const text = doc.toText();
  doc.source = text;
  game.setMapText(text);
}

// The attributes changed together, e.g. x and y of a move. Returns whether all of them
// are live in the game now.
function change(e, values) {
  const doc = editorDoc();
  let live = true;
  let any = false;
  for (const [attr, raw] of Object.entries(values)) {
    const value = String(raw);
    checkValue(attr, value);
    if (!doc.set(e, attr, value)) continue;
    any = true;
    if (!applyLive(e, doc.ordinal(e), attr)) { live = false; markPending(e); }
  }
  if (!any) return { changed: false, live: true };
  syncMapText(doc);
  notify('edit');
  return { changed: true, live };
}

export const setAttr = (e, attr, value) => change(e, { [attr]: value });

// A rectangle's place and size, or a point's place (w and h ignored).
export function setPlace(e, { x, y, w, h }) {
  const values = { x: tidy(x), y: tidy(y) };
  if (kindOf(e.tag)?.shape === SHAPE.RECT) Object.assign(values, { w: tidy(w), h: tidy(h) });
  return change(e, values);
}

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
  if (what === 'doc') returnTo = null; // another map loaded instead
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
