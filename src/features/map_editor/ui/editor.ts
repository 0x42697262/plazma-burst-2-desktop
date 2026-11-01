import { COLOR } from '#console/kernel/core/keys.ts';
import { showKey, eventKeyName, type KeyEvent } from '#console/kernel/state/key-names.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import {
  setEditor, editorOn, editorShown, selected, select, onChange, editorTick, currentTool, setTool, TOOL, NOTICE, cancelPick,
} from '../services/session.ts';
import { deleteElement, duplicateElement, undo, redo } from '../services/edit.ts';
import { showEditorView } from './view.ts';
import { showPanels, say } from './panels.ts';
import { dropdownOpen, closeDropdown } from './dropdown.ts';
import { captureMouse } from './input.ts';
import { EDITOR_KEYS } from './keys.ts';
import { PANELS_TEXT } from './text.ts';

export { editorOn, editorTick };

onChange((what) => {
  if (what !== NOTICE.shown) return;
  const on = editorShown();
  const key = settings.effective(KEY.EDITOR_KEY);
  showEditorView(on);
  showPanels(on, key ? showKey(stringOf(key)) : '');
  captureMouse(on, (error) => { say(PANELS_TEXT.error(error.message), COLOR.error); });
});

export const setEditorOn = (on: boolean): boolean => setEditor(on);

const KEYS: Readonly<Record<string, () => boolean>> = Object.freeze({
  [EDITOR_KEYS.escape]: () => {
    if (dropdownOpen()) {
      closeDropdown();
      return true;
    }
    if (cancelPick()) return true;
    if (currentTool() !== TOOL.SELECT) {
      setTool(TOOL.SELECT);
      return true;
    }
    if (selected()) {
      select(null);
      return true;
    }
    return false;
  },
  [EDITOR_KEYS.delete]: () => {
    const current = selected();
    if (!current) return false;
    deleteElement(current);
    return true;
  },
  [EDITOR_KEYS.duplicate]: () => {
    const current = selected();
    if (!current) return false;
    duplicateElement(current);
    return true;
  },
  [EDITOR_KEYS.undo]: () => {
    undo();
    return true;
  },
  [EDITOR_KEYS.redo]: () => {
    redo();
    return true;
  },
  [EDITOR_KEYS.redoShift]: () => {
    redo();
    return true;
  },
});

export function editorKey(event: KeyEvent): boolean {
  if (!editorShown()) return false;
  const name = eventKeyName(event);
  const handler = Object.hasOwn(KEYS, name) ? KEYS[name] : undefined;
  if (!handler) return false;
  try {
    return handler();
  } catch (error) {
    say(PANELS_TEXT.error((error as Error).message), COLOR.error);
    return true;
  }
}
