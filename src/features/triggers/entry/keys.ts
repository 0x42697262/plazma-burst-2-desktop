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
export const TRIGGERS_COMMAND = Object.freeze({
  name: 'triggers', aliases: Object.freeze(['trigger', 'trig']),
  history: 'history', historyAliases: Object.freeze(['hist', 'log']),
  find: 'find', findAliases: Object.freeze(['search']),
  run: 'run', runAliases: Object.freeze(['activate', 'fire']),
  exec: 'exec', execAliases: Object.freeze(['paste', 'script']),
  actions: 'actions', actionsAliases: Object.freeze(['ops', 'opcodes']),
});
export const FILTER_WORD = Object.freeze({ on: 'on', off: 'off', all: 'all', clear: 'clear' });
export const YOU = 'you';
export const NUMBER_TEXT = /^-?\d+(\.\d+)?$/;
export const DIGITS = /^\d+$/;
export const FIELD = Object.freeze({ any: 'ab', uid: 'uid', a: 'a', b: 'b', type: 'type', by: 'by', calls: 'calls', maxcalls: 'maxcalls' } as const);
export const TRIGGER_FIELDS: ReadonlySet<string> = new Set([FIELD.uid, FIELD.by, FIELD.calls, FIELD.maxcalls]);
export const UNLIMITED_WORDS: readonly string[] = Object.freeze(['unlimited', 'inf', 'infinite', '-1']);
export const COMPARISON = /^(<=|>=|!=|<|>|=)?(.+)$/;
export const EQUALS = '=';
export const COMPARE: Readonly<Record<string, (first: number, second: number) => boolean>> = Object.freeze({
  '=': (first, second) => first === second, '!=': (first, second) => first !== second, '>': (first, second) => first > second,
  '<': (first, second) => first < second, '>=': (first, second) => first >= second, '<=': (first, second) => first <= second,
});
export const NO_SOURCE = 'none';
export const BY_WORDS: Readonly<Record<string, string>> = Object.freeze({
  region: 'region', timer: 'timer', chat: 'chat', death: 'death', player: 'death', trigger: 'trigger', start: 'start', none: NO_SOURCE,
});
export const NUMBERED_SOURCES: ReadonlySet<string> = new Set(['region', 'timer', 'death', 'trigger']);
export const BY_TERM = /^([a-z]+)(?:#?(\d+))?$/;
export const TERM = /^(uid|a|b|type|by|calls|maxcalls):(.*)$/i;
export const EXEC_OPTIONS: readonly string[] = Object.freeze(['check', 'force']);
export const EXEC_OPTION = Object.freeze({ check: 'check', force: 'force' });
export const FIRST_WORD = /^\S+\s*/;
export const LEADING_OPTIONS = /^(?:--\S*\s*)*/;
export const SINGLE_WORD = /^#?\S+$/;
export const TRUE_TEXT = 'true';
