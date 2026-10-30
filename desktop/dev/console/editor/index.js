// The in-game map editor: edit the level you are playing, from inside it. The game keeps
// running; the editor draws over it and takes the mouse.
//
// session.js  state: on/off, the map document (doc.js), selection, hidden layers
// kinds.js    every element kind: name, colour, shape
// edit.js     changing the document; apply.js puts what it can into the running game
// live.js     where elements are in the running game
// view.js     the overlay layer: outlines, selection, logic links
// panels.js   Layers, Objects, Params, the status line
// input.js    the click layer: select, drag, resize
// Views listen to the session; the session never draws.
import { showKey } from '../state/keys.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { setEditor, editorOn, editorShown, selected, select, onChange, editorTick } from './session.js';
import { showEditorView } from './view.js';
import { showPanels, say } from './panels.js';
import { COLOR } from '../core/colors.js';
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

// A key while the editor is on and the console closed. True when the editor used it.
export function editorKey(e) {
  if (!editorShown()) return false;
  if (e.key === 'Escape' && selected()) { select(null); return true; }
  return false;
}
