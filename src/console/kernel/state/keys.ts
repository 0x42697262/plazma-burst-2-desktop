export const SYMBOL_KEYS: Readonly<Record<string, string>> = Object.freeze({
  '`': 'backquote', '-': 'minus', '=': 'equal', '[': 'bracketleft', ']': 'bracketright',
  '\\': 'backslash', ';': 'semicolon', '\'': 'quote', ',': 'comma', '.': 'period', '/': 'slash',
  ' ': 'space', esc: 'escape', return: 'enter', del: 'delete', ins: 'insert',
  up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', pgup: 'pageup', pgdn: 'pagedown',
});
export const SHIFTED_KEYS: Readonly<Record<string, string>> = Object.freeze({
  '~': 'backquote', '!': '1', '@': '2', '#': '3', '$': '4', '%': '5', '^': '6', '&': '7', '*': '8',
  '(': '9', ')': '0', '_': 'minus', '+': 'equal', '{': 'bracketleft', '}': 'bracketright',
  '|': 'backslash', ':': 'semicolon', '"': 'quote', '<': 'comma', '>': 'period', '?': 'slash',
});
export const MODIFIER = Object.freeze({ ctrl: 'ctrl', alt: 'alt', shift: 'shift' } as const);
export const MODIFIERS: readonly string[] = Object.freeze([MODIFIER.ctrl, MODIFIER.alt, MODIFIER.shift]);
export const MODIFIER_ALIASES: Readonly<Record<string, string>> = Object.freeze({ control: 'ctrl', ctl: 'ctrl', option: 'alt' });
export const TOGGLE_KEY = 'shift+backquote';
export const INPUT_KEYS: readonly string[] = Object.freeze(['escape', 'enter']);
export const KEY_SEPARATOR = '+';
export const PLUS_KEY = '+';
export const SPACE_KEY = 'space';
export const BACKQUOTE_WORD = /\bbackquote\b/;
export const BACKQUOTE = '`';
export const LETTER_CODE = /^key([a-z])$/;
export const DIGIT_CODE = /^digit(\d)$/;
export const FIRST_GROUP = '$1';
export const KEY_NAME = /^[a-z0-9]+$/;
export const MODIFIER_KEY_NAME = /^(control|shift|alt|meta)(left|right)?$/;

export const GAME_KEYS: Readonly<Record<string, string>> = Object.freeze({
  w: 'jump', a: 'move left', s: 'crouch', d: 'move right', space: 'jump', arrowup: 'jump', arrowdown: 'crouch',
  arrowleft: 'move left', arrowright: 'move right', e: 'use', insert: 'use', g: 'grenade', numpad0: 'grenade',
  q: 'previous weapon', v: 'drop weapon', backspace: 'drop weapon', x: 'action', z: 'zoom', pageup: 'zoom',
  pagedown: 'zoom', c: 'game key', r: 'game key', t: 'game key', p: 'game key', tab: 'score table', end: 'score table',
  backquote: 'swords', 0: 'swords', 1: 'weapon 1', 2: 'weapon 2', 3: 'weapon 3', 4: 'weapon 4', 5: 'weapon 5',
  6: 'weapon 6', 7: 'weapon 7', 8: 'weapon 8', 9: 'weapon 9', f1: 'game key', f2: 'game key', f3: 'game key',
  f4: 'game key', f5: 'quick save', f9: 'quick load',
});

export const SETTING_TYPE = Object.freeze({ bool: 'bool', number: 'number', int: 'int', key: 'key' } as const);
export type SettingType = typeof SETTING_TYPE[keyof typeof SETTING_TYPE];
export const GROUP = Object.freeze({
  player: 'player', world: 'world', bullets: 'bullets', gun: 'gun', console: 'console', maps: 'maps', network: 'network',
} as const);
export type Group = typeof GROUP[keyof typeof GROUP];
export const CONSOLE_GROUPS: ReadonlySet<Group> = new Set([GROUP.console, GROUP.maps, GROUP.network]);
export const TRUE_WORDS: readonly string[] = Object.freeze(['1', 'on', 'true', 'yes', 'y', 'enable', 'enabled']);
export const FALSE_WORDS: readonly string[] = Object.freeze(['0', 'off', 'false', 'no', 'n', 'disable', 'disabled']);
export const NO_KEY_WORD = 'none';

export const STORAGE_KEY = 'pb2dev_kv';
export const FILE_SECTION = Object.freeze({ binds: 'binds', history: 'history', profiles: 'profiles', maps: 'maps', oldTeleportKey: 'tp_key' } as const);
export const FILE_SECTIONS: readonly string[] = Object.freeze(Object.values(FILE_SECTION));
export const PROFILE_SECTION = Object.freeze({ binds: 'binds', onload: 'onload' } as const);
export const PROFILE_SECTIONS: readonly string[] = Object.freeze(Object.values(PROFILE_SECTION));
export const PROFILE_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/i;
export const SOURCE = Object.freeze({ yours: 'yours', default: 'default' } as const);
export const LOAD_SOURCE = Object.freeze({ file: 'file', localStorage: 'localStorage' } as const);
export type LoadSource = typeof LOAD_SOURCE[keyof typeof LOAD_SOURCE];
export const CHAIN_JOIN = '; ';
export const TELEPORT_COMMAND = 'tp';
export const SPACE_CHARACTER = ' ';
export const EMPTY_FILE = '{}';
export const NO_STORE = 'no-store';
export const PUT_METHOD = 'PUT';
export const TRAILING_BIND_WORD = /bind $/;
export const SCREENSHOT_COMMAND = 'screenshot';
export const EDITOR_COMMAND = 'editor';
