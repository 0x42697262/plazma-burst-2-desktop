export const CHANNEL = Object.freeze({ match: 'match', lobby: 'lobby' } as const);
export type Channel = typeof CHANNEL[keyof typeof CHANNEL];

export const FIELD_KIND = Object.freeze({
  slot: 'slot',
  authId: 'authId',
  number: 'number',
  decimal: 'decimal',
  text: 'text',
  json: 'json',
  flag: 'flag',
  choice: 'choice',
} as const);
export type FieldKind = typeof FIELD_KIND[keyof typeof FIELD_KIND];

export const DEFAULT_RULE = Object.freeze({
  self: 'self',
  aim: 'aim',
  near: 'near',
  area: 'area',
  replyId: 'replyId',
  myHmax: 'myHmax',
  myGun: 'myGun',
  myPosX: 'myPosX',
  myPosY: 'myPosY',
  targetRespawns: 'targetRespawns',
  zero: 'zero',
  empty: 'empty',
} as const);
export type DefaultRule = typeof DEFAULT_RULE[keyof typeof DEFAULT_RULE];

export const VAR_SYNC_MODE = Object.freeze(['r', 'd', 'x', 'n', 'l'] as const);

export const RELIABLE_PREFIX = 'reliable_';
export const TYPE_PREFIX = 'RELIABLE_';
export const OTHER_CLIENTS = 'every other client';

export const TOKEN = Object.freeze({
  flagPrefix: '--', assign: '=', rawPrefix: 'raw:', listSeparator: ',', ruleSeparator: ':', filterPrefix: '@', indexPrefix: '#',
});

export const FLAG = Object.freeze({ dry: 'dry', raw: 'raw', force: 'force' });

export const SELECTOR = Object.freeze({ me: 'me', all: 'all', aim: 'aim', near: 'near', area: 'area' });

export const FILTER = Object.freeze({ players: 'players', bots: 'bots' });

export const CHAR = Object.freeze({ respawns: 'respawns', currentGun: 'curwea' });

export const SETTING = Object.freeze({ radius: 'wire_radius' });

export const WIRE_VALUE = Object.freeze({ on: '1', off: '0' });

export const COMMAND = Object.freeze({ name: 'wire', aliases: Object.freeze([] as string[]), list: 'list', help: 'help' });
