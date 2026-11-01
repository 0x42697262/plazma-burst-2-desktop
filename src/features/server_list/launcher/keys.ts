export { hostPortOf } from '../keys.ts';

export const FIELD = Object.freeze({ name: 'name', address: 'address', fingerprint: 'fingerprint', nickname: 'nickname', password: 'password' });
export const LAUNCHER_FIELDS: readonly string[] = Object.freeze([FIELD.name, FIELD.address, FIELD.fingerprint, FIELD.nickname]);
export const PASSWORD_FIELD = FIELD.password;

export const LAUNCHER_ELEMENT = Object.freeze({
  rows: '#servers tbody', note: '#note', play: '#play', add: '#add', edit: '#edit', remove: '#remove', refresh: '#refresh',
  form: '#form', formTitle: '#form-title', errors: '#errors', getFingerprint: '#get-fp', fingerprintNote: '#fp-note', save: '#save', cancel: '#cancel',
});

export const LAUNCHER_CLASS = Object.freeze({
  attribute: 'class', muted: 'muted', bad: 'bad', good: 'good', warn: 'warn', smallLine: 'muted small-line', selected: 'selected',
  name: 'name', tag: 'tag', address: 'addr', number: 'num', description: 'desc',
});

export const LAUNCHER_EVENT = Object.freeze({ click: 'click', doubleClick: 'dblclick', keyDown: 'keydown' });
export const LAUNCHER_KEY = Object.freeze({ enter: 'Enter', down: 'ArrowDown', up: 'ArrowUp' });
export const CHECK_STATE = Object.freeze({ checking: 'checking' } as const);
export const fieldSelector = (name: string): string => `[name="${name}"]`;
