export const REGIONS_COMMAND = Object.freeze({ name: 'regions', aliases: Object.freeze(['region']), run: 'run', runAliases: Object.freeze(['fire', 'use', 'activate']) });
export const VARS_COMMAND = Object.freeze({ name: 'vars', aliases: Object.freeze(['var', 'variables']), set: 'set', setAliases: Object.freeze(['get', 'del', 'unset', 'rm']), sync: 'sync' });
export const WRITE_VERBS = Object.freeze({ set: 'set', get: 'get', del: 'del', unset: 'del', rm: 'del' } as const);
export const NO_UID = '-';
export const SPACE = ' ';
export const HASH = '#';
export const LOGIC_COMMAND = Object.freeze({
  name: 'logic', aliases: Object.freeze(['links']),
  show: 'show', showAliases: Object.freeze(['draw', 'on']),
  hide: 'hide', hideAliases: Object.freeze(['off']),
  tree: 'tree',
});
export const DEPTH_WORD = 'depth';
export const SCREEN_WORDS: readonly string[] = Object.freeze(['screen', 'visible', 'onscreen']);
export const TYPE_PREFIX = 'type:';
export const NOT_PREFIX = 'not:';
export const LIST_SEPARATOR = ',';
export const PLURAL_ENDINGS: readonly RegExp[] = Object.freeze([/s$/, /es$/]);
export const ACTION_LABEL = /^action (\d+): (.*)$/;
export const INDENT = '   ';
export const FROM_END = 'from';
export const TO_END = 'to';
