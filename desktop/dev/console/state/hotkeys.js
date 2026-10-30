// Keys that run a console command anywhere in the game, before binds and the game see
// them: the screenshot key and the editor key. Each one is a 'key' setting, so it is
// changed like any other ("screenshot_key f2", "editor_key off").
import { KEY } from './schema.js';
import { settings } from './store.js';

export const HOTKEYS = Object.freeze([
  { key: KEY.SCREENSHOT_KEY, what: 'the screenshot key', command: 'screenshot' },
  { key: KEY.EDITOR_KEY, what: 'the editor key', command: 'editor' },
]);

// The hotkey a key name is now, or undefined.
export const hotkeyOf = (name) => HOTKEYS.find((h) => settings.effective(h.key) === name);
