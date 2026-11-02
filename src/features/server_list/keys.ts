export const OFFICIAL_ID = 'official';
export const OFFICIAL_SERVER = Object.freeze({ id: OFFICIAL_ID, name: 'PlazmaBurst2.com', host: 'vvvv.plazmaburst2.com', port: 2053 });

export const OPERATION = Object.freeze({
  list: 'list', save: 'save', remove: 'remove', check: 'check', fingerprint: 'fingerprint', play: 'play', openList: 'openList',
});
export type Operation = typeof OPERATION[keyof typeof OPERATION];
export const OPERATIONS: readonly string[] = Object.freeze(Object.values(OPERATION));

export const IPC_CHANNEL = Object.freeze({
  list: 'servers:list', save: 'servers:save', remove: 'servers:remove', check: 'servers:check', fingerprint: 'servers:fingerprint', play: 'servers:play',
  switchClient: 'servers:switch-client',
});
export const LAUNCHER_BRIDGE = 'pb2servers';
export const FILE_PROTOCOL = 'file:';
export const URL_HASH = '#';

export const ADDRESS_SCHEME = /^https?:\/\//;
export const TRAILING_SLASHES = /\/+$/;
export const ADDRESS_PARTS = /^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/;
export const HOST_PATTERN = /^(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)$/;
export const IPV6_BRACKETS = /^\[|\]$/g;
export const FINGERPRINT_PATTERN = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
export const FINGERPRINT_PREFIX = /^SHA256[:/ ]?/;
export const NOT_HEX = /[^0-9A-F]/g;
export const BYTE_PAIRS = /(..)(?=.)/g;
export const BYTE_PAIR_WITH_COLON = '$1:';
export const NICKNAME_PATTERN = /^[A-Za-z0-9 _.-]{1,20}$/;
export const SERVER_ID_PATTERN = /^[a-z0-9]{6,32}$/;
export const ID_ENCODING = 'hex';
export const BYTE_ORDER_MARK = /^\uFEFF/;

export const STATUS_PATH = '/status';
export const STATUS_OK = /^HTTP\/1\.[01] 200/;
export const HEADER_END = '\r\n\r\n';
export const CHUNKED = /transfer-encoding:\s*chunked/i;
export const CHUNK_START = /^[0-9a-f]+\r\n/i;
export const CHUNK_END = /\r\n0\r\n\r\n$/;
export const statusRequest = (hostPort: string): string => `GET ${STATUS_PATH} HTTP/1.1\r\nHost: ${hostPort}\r\nConnection: close\r\n\r\n`;
export const SOCKET_EVENT = Object.freeze({ error: 'error', connect: 'connect', secureConnect: 'secureConnect', data: 'data', end: 'end' });

export const SERVERS_FILE_NAME = 'servers.json';
export const OLD_JOIN_FILE_NAME = 'join.json';
export { PAGE_JOIN_GLOBAL } from '#page/keys.ts';

export const SERVER_FIELDS = Object.freeze(['address', 'fingerprint', 'nickname', 'password', 'name']);
export const PAIR_PATTERN = /([A-Za-z_]+)=(?:"([^"]*)"|(\S*))/g;
export const PASSWORD_IN_LINE = /\b(password=)(?:"[^"]*"|\S*)/gi;
export const PASSWORD_MASK = '\u2022\u2022\u2022';
export const FETCH_FINGERPRINT_WORD = 'fetch';
export const NUMBER_WORD = /^\d+$/;
export const OFFICIAL_NUMBER = '0';
export const skipWords = (count: number): RegExp => new RegExp(`^(?:\\S+\\s*){${count}}`);

export const COMMAND = Object.freeze({
  name: 'servers', aliases: ['server-list'],
  list: 'list', listAliases: ['ls', 'refresh'],
  connect: 'connect', connectAliases: ['join', 'play'],
  add: 'add', edit: 'edit',
  remove: 'remove', removeAliases: ['rm', 'delete'],
  fingerprint: 'fingerprint', fingerprintAliases: ['fp'],
  page: 'page', pageAliases: ['menu', 'back'],
});

export const JOIN_STARTUP_FRAMES: readonly (string | null | undefined)[] = Object.freeze(['startup', 'loading', 'name_prompt', 'ads', 'null', undefined, null]);
export const OFFICIAL_LOCATION = 'USA, Arizona';
export const hostPortOf = (host: string, port: number): string => `${host}:${port}`;
export const lobbyAddressOf = (address: string): string => `https://${address}/?`;
export const MASKED_PASSWORD_REPLACEMENT = `$1${PASSWORD_MASK}`;
export const WORD_SEPARATOR = ' ';
