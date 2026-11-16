export const FEATURES_COMMAND = Object.freeze({ name: 'features', alias: 'flags' });
export const QUOTED_COMMAND = /^"([\s\S]*)"$/;
export const WHITESPACE = /\s+/;
export const WORD_SEPARATOR = ' ';
export const FIRST_CAPTURE = '$1';
export const ANONYMOUS_FRAME = 'at <anonymous>:';
export const CHAIN_SEPARATOR = ';';
export const QUOTE = '"';
export const MODIFIERS_ONLY = /^((ctrl|control|ctl|alt|option|shift)\+)*$/i;
export const KEY_TYPE = 'key';
export const BOOL_TYPE = 'bool';
export const INT_TYPE = 'int';
export const RESET_WORDS: readonly string[] = Object.freeze(['default', 'reset', 'unset']);
export const SOURCE_YOURS = 'yours';
export const SOURCE_DEFAULT = 'default';
export const KEY_JOIN = '_';
export const HELP_COMMAND = Object.freeze({ name: 'help', alias: '?' });
export const SETTINGS_COMMAND = Object.freeze({
  list: 'list', listAlias: 'ls', set: 'set', get: 'get', unset: 'unset', unsetAliases: Object.freeze(['del', 'rm']), reset: 'reset',
});
export const CONSOLE_COMMAND = Object.freeze({
  more: 'more', moreAliases: Object.freeze(['next', 'page', 'pg']), chain: 'chain', chainAlso: ';',
  clear: 'clear', clearAlias: 'cls', close: 'close', closeAlias: 'exit',
});
export const HOLD_OPTION = Object.freeze({ on: '--on', off: '--off' });
export const HOLD_WORD = Object.freeze({ on: 'on', off: 'off' });
export const withWord = (command: string, word: string): string => `${command} ${word}`;
export const MOUSE_BUTTON_NAMES: Readonly<Record<number, string>> = Object.freeze({ 0: 'mouse1', 1: 'mouse3', 2: 'mouse2', 3: 'mouse4', 4: 'mouse5' });
