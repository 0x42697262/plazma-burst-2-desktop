export const SERVER_DEFAULTS = Object.freeze({
  name: 'Plazma Burst 2 server',
  description: '',
  port: 2053,
  bind: '0.0.0.0',
  password: '',
  nicknames: Object.freeze([]),
  admins: Object.freeze([]),
  max_players: 64,
  skin: 1,
  download_maps: true,
  random_maps: Object.freeze([]),
  cheat_reports: 'log',
  welcome: '',
});
export const PORT_RANGE = Object.freeze({ min: 0, max: 65535 });
export const MAX_NAME_LENGTH = 40;
export const MAX_DESCRIPTION_LENGTH = 200;
export const CERT_DAYS = 3650;
export const CERT_KEY_SIZE = 2048;
export const KEY_FILE_MODE = 0o600;
export const BANS_INDENT = 1;
export const TICK_MS = 16;
export const FIRST_UID = 1000;
export const REPUTATION = 40;
export const MAX_NICKNAME = 20;
export const MAX_MAP_PLAYERS = 64;
export const MAP_TIMEOUT_MS = 15000;
export const WELCOME_DELAY_MS = 1000;
export const KICK_DELAY_MS = 300;
export const CLOSE_DELAY_MS = 500;
export const CHEAT_DETAIL_LENGTH = 200;
export const OK = 200;
export const NOT_FOUND = 404;
export const PING_WIDTH = 5;
export const NICKNAME_WIDTH = 20;
export const ADDRESS_WIDTH = 16;
export const MATCH_NUMBER_WIDTH = 2;
export const HEX_RADIX = 16;
export const HEX_DIGITS = 2;
