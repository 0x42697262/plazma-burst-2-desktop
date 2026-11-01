export const REGIONS_COMMAND = Object.freeze({ name: 'regions', aliases: Object.freeze(['region']), run: 'run', runAliases: Object.freeze(['fire', 'use', 'activate']) });
export const VARS_COMMAND = Object.freeze({ name: 'vars', aliases: Object.freeze(['var', 'variables']), set: 'set', setAliases: Object.freeze(['get', 'del', 'unset', 'rm']), sync: 'sync' });
export const WRITE_VERBS = Object.freeze({ set: 'set', get: 'get', del: 'del', unset: 'del', rm: 'del' } as const);
export const NO_UID = '-';
export const SPACE = ' ';
export const HASH = '#';
