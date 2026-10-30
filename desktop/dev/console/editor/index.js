// The in-game map editor: edit the level you are playing, from inside it. The game keeps
// running; the editor draws over it and takes the mouse.
//
// session.js  state: on/off, the map document (doc.js), selection, hidden layers
// kinds.js    every element kind: name, colour, shape
// live.js     where elements are in the running game
// view.js     the overlay layer: outlines, selection, logic links
// panels.js   Layers, Objects, Params
// input.js    the click layer
// Views listen to the session; the session never draws.
import { showKey } from '../state/keys.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { setEditor, editorOn, selected, select, onChange, editorTick } from './session.js';
import { showEditorView } from './view.js';
import { showPanels } from './panels.js';
import { captureMouse } from './input.js';

export { editorOn, editorTick };

onChange((what) => {
  if (what !== 'on') return;
  const on = editorOn();
  const key = settings.effective(KEY.EDITOR_KEY);
  showEditorView(on);
  showPanels(on, key ? showKey(key) : '');
  captureMouse(on);
});

// Turns it on or off; returns whether that changed anything.
export const setEditorOn = (on) => setEditor(on);

// A key while the editor is on and the console closed. True when the editor used it.
export function editorKey(e) {
  if (!editorOn()) return false;
  if (e.key === 'Escape' && selected()) { select(null); return true; }
  return false;
}
