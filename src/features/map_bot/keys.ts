import { OFFICIAL_LOBBY } from '#shared/clients/keys.ts';

export const OFFICIAL_LOBBY_URL = `https://${OFFICIAL_LOBBY.host}:${OFFICIAL_LOBBY.port}`;
export const MAP_SOURCE_NAME = 'official_lobby';
export const ACCOUNT_FILE_VARIABLE = 'PB2_MAP_BOT_ACCOUNT';
export const ACCOUNT_FILE = 'map-bot-account.json';
export const TEXT_ENCODING = 'utf8';
export const MD5_HEX = /^[0-9a-f]{32}$/;

export const GAME_SCRIPTS: readonly string[] = Object.freeze([
  '_strings.js', 'scripts/libs/socket.io.min.js', 'scripts/libs/tools.js', 'scripts/libs/xml.js', 'scripts/connection.js', 'scripts/libs/flash.js',
]);
export const STRINGS_SCRIPT = '_strings.js';
export const PAGE_HREF = 'https://www.plazmaburst2.com/';
export const PAGE_HOST = 'www.plazmaburst2.com';
export const PAGE_PROTOCOL = 'https:';
export const USER_AGENT = 'pb2-map-bot';
export const CONTEXT_ARRAY = 'Array';
export const SILENT_HUD = 'globalThis.HUD = new Proxy(function () {}, { get: () => globalThis.HUD, apply: () => undefined });';
export const setupCall = (setupClass: string, setupMethod: string): string => `${setupClass}.${setupMethod}(null, null)`;

export const NEEDED_NAMES = Object.freeze([
  'net', 'lobbyConn', 'setupClass', 'setupMethod', 'connClass', 'netTick', 'netSend', 'netChannel', 'netReplyTo', 'connRecv', 'connClosed',
  'netDigits', 'netTypeNames', 'tickGuardBefore', 'tickGuardAfter',
] as const);
export type NeededName = typeof NEEDED_NAMES[number];

export const MESSAGE = Object.freeze({
  authenticate: 'RELIABLE_AUTHENTICATE',
  createMatch: 'RELIABLE_CREATE_MATCH',
  mapChunk: 'RELIABLE_MAP_CHUNK',
});
export const TASK_MESSAGES: readonly string[] = Object.freeze(['RELIABLE_TASK', 'RELIABLE_TASK_ASNYC']);
export const REPLY_PLACEHOLDER = 'REPLY';
export const REPLY_OK = 'ok';
export const LOBBY_CLIENT = Object.freeze({ version: 'version_h5', hash: 'hash_h5', build: '1769098189070' });
export const DEVICE_SEPARATOR = '.';
export const BASE_36 = 36;
export const NOT_PUBLISHED = /not published/i;

export const PRESET = Object.freeze({
  ranked: false,
  maxPlayers: 2,
  gameType: 'DM',
  minReputation: 0,
  mapRotation: '',
  gameplayModifications: '',
  pingLimit: '',
  roundsUntilRotation: '15',
  roundDurationText: 'default',
  roundDuration: 0,
  p2p: false,
  p2pRegion: '',
  excludeInactivePlayers: true,
  allowVpnGuests: 1,
  pingLimitAction: 'spectate',
  respawnModel: 'v2',
  acceptConnectionsManually: false,
});
export const TITLE_PREFIX = 'map ';
export const PASSWORD_BYTES = 9;
export const PASSWORD_ENCODING = 'base64url';
