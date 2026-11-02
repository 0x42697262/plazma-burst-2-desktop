import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  screenshot_key: {
    capability: CAPABILITY.screenshot.key, aliases: Object.freeze(['screenshotkey', 'shot_key', 'sskey']), hotkey: Object.freeze({ what: 'the screenshot key', command: 'screenshot' }), type: SETTING_TYPE.key, group: GROUP.console, default: 'f12',
    desc: 'Key that saves a screenshot to data/screenshots/, anywhere in the game; off = none',
    about: ['Works in menus, levels and with the console open (the console is left out of',
      'the picture). A function key works while you type; other keys wait until you',
      'are not typing in the chat or the console.'],
    example: 'f2',
  },
});
