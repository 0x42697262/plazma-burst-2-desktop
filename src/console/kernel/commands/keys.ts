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
  list: 'list', listAlias: 'ls', set: 'set', get: 'get', unset: 'unset', unsetAliases: Object.freeze(['del', 'rm']), reset: 'reset', builtin: 'builtin',
});
export const CONSOLE_COMMAND = Object.freeze({
  more: 'more', moreAliases: Object.freeze(['next', 'page', 'pg']), chain: 'chain', chainAlso: ';',
  clear: 'clear', clearAlias: 'cls', close: 'close', closeAlias: 'exit',
});
export const CHECKS_SECTION = 'checks';
