import { EDITOR_COMMAND, SCREENSHOT_COMMAND } from './keys.ts';
import { TEXT } from './text.ts';
import { KEY } from './schema.ts';
import { settings } from './store.ts';

export type Hotkey = Readonly<{ key: string; what: string; command: string }>;

export const HOTKEYS: readonly Hotkey[] = Object.freeze([
  { key: KEY.SCREENSHOT_KEY, what: TEXT.screenshotKey, command: SCREENSHOT_COMMAND },
  { key: KEY.EDITOR_KEY, what: TEXT.editorKey, command: EDITOR_COMMAND },
]);

export const hotkeyOf = (name: string): Hotkey | undefined => HOTKEYS.find((hotkey) => settings.effective(hotkey.key) === name);
