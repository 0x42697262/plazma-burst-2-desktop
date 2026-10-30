// The in-game map editor: edit the level you are playing, from inside it. The game keeps
// running; the editor draws over it and takes the mouse.
//
// session.js  state: on/off, the map document (doc.js), selection, active layers
// kinds.js    every element kind: name, colour, shape
// edit.js     changing the document; apply.js puts what it can into the running game
// live.js     where elements are in the running game
// view.js     the overlay layer: outlines, selection, logic links
// history.js  undo and redo
// panels.js   Tools, Layers, Objects, Params, the status line
// input.js    presses in the world: select, drag, resize, place
// Views listen to the session; the session never draws.
import { COLOR } from '../core/colors.js';
import { showKey, eventKeyName } from '../state/keys.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import {
  setEditor, editorOn, editorShown, selected, select, onChange, editorTick, currentTool, setTool, TOOL,
} from './session.js';
import { deleteElement, duplicateElement, undo, redo } from './edit.js';
import { showEditorView } from './view.js';
import { showPanels, say } from './panels.js';
import { captureMouse } from './input.js';

export { editorOn, editorTick };

onChange((what) => {
  if (what !== 'shown') return;
  const on = editorShown();
  const key = settings.effective(KEY.EDITOR_KEY);
  showEditorView(on);
  showPanels(on, key ? showKey(key) : '');
  captureMouse(on, (err) => say(`error: ${err.message}`, COLOR.error));
});

// Turns it on or off; returns whether that changed anything.
export const setEditorOn = (on) => setEditor(on);

// The editor's keys, while it is shown and the console closed (not while typing).
// Each returns whether it did something; a key that did nothing goes on to the game.
const KEYS = Object.freeze({
  escape: () => {
    if (currentTool() !== TOOL.SELECT) { setTool(TOOL.SELECT); return true; }
    if (selected()) { select(null); return true; }
    return false;
  },
  delete: () => { const sel = selected(); if (!sel) return false; deleteElement(sel); return true; },
  'ctrl+d': () => { const sel = selected(); if (!sel) return false; duplicateElement(sel); return true; },
  'ctrl+z': () => { undo(); return true; },
  'ctrl+y': () => { redo(); return true; },
  'ctrl+shift+z': () => { redo(); return true; },
});

// A key event; true when the editor used it (the caller keeps it from the game).
export function editorKey(e) {
  if (!editorShown()) return false;
  const fn = KEYS[eventKeyName(e)];
  if (!fn) return false;
  try { return fn(); } catch (err) { say(`error: ${err.message}`, COLOR.error); return true; }
}
