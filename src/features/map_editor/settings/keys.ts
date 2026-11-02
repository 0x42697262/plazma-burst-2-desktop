import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  editor_key: {
    aliases: Object.freeze(['editorkey', 'edit_key']), hotkey: Object.freeze({ what: 'the editor key', command: 'editor' }), type: SETTING_TYPE.key, group: GROUP.console, default: 'f8',
    desc: 'Key that turns the map editor on and off in a level; off = none',
    about: ['Turns the in-game map editor on and off ("editor"). Works with the console',
      'open too. F11 is not the default: the window menu uses it for fullscreen.'],
    example: 'f7',
  },
});
