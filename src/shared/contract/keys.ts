export const DEV_DIR = '__dev/';

export const ROUTE_NAME = Object.freeze({
  names: 'names.js',
  opcodes: 'opcodes.js',
  console: 'console/',
  kv: 'kv',
  maps: 'maps',
  saveMap: 'savemap',
  saveEdited: 'saveedited',
  mapFile: 'mapfile',
  screenshot: 'screenshot',
  netLog: 'netlog',
  netRuns: 'netruns',
  netRead: 'netread',
  fingerprint: 'fingerprint',
  fingerprints: 'fingerprints',
  servers: 'servers',
});

export const MAP_MARKER = Object.freeze({
  compressedPrefix: '<q.',
  notPublished: '<not_published',
});

export const SAVE_RESULT = Object.freeze({
  saved: 'saved',
  same: 'same',
  off: 'off',
});

export const HTTP_METHOD = Object.freeze({ get: 'GET', post: 'POST', put: 'PUT' });
export const STATUS = Object.freeze({ ok: 200, badRequest: 400, forbidden: 403, notFound: 404, methodNotAllowed: 405, conflict: 409, tooMany: 429, serverError: 500 });
export const NO_STORE_CACHE = 'no-store';
export const QUERY_START = '?';
