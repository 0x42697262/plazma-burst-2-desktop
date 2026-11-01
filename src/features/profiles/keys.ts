export const NONE = 'none';
export const CLEAR = '--clear';
export const LIST_SECTION = 'profile';
export const MAP_SEPARATOR = '|';
export const LIST_SEPARATOR = ', ';
export const COMMAND = Object.freeze({
  name: 'profile', aliases: ['profiles'],
  list: 'list', listAliases: ['ls'], show: 'show', use: 'use', set: 'set',
  unset: 'unset', unsetAliases: ['rm', 'del'], bind: 'bind', unbind: 'unbind',
  onload: 'onload', onloadAliases: ['autorun', 'onjoin'], delete: 'delete', deleteAliases: ['remove'],
});
export const BIND_KEY_ARGUMENT = 3;
