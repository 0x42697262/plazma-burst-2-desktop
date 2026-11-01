export const CONFIG_FILE_NAME = 'p2p-host.json';
export const EXAMPLE_CONFIG_FILE_NAME = 'p2p-host.example.json';
export const SETTINGS_FILE_NAME = 'p2p-host-overrides.json';

export const GAME_TYPES: readonly string[] = Object.freeze(['DM', 'TDM', 'COOP']);
export const PING_ACTIONS: readonly string[] = Object.freeze(['spectate', 'spectate_then_ban', 'pause_match', 'notify_everyone']);
export const RESPAWN_MODELS: readonly string[] = Object.freeze(['v2', 'v1']);
export const TEXT_MATCH_FIELDS = Object.freeze(['title', 'map_id', 'map_rotation', 'password', 'gameplay_modifications', 'round_duration_str'] as const);
export const SPLIT_MARKER_FIELDS = Object.freeze(['title', 'map_id'] as const);
export const SERVER_SPLIT_MARKER = '[^c]';
export const MATCH_KEY = 'match';
export const PRIVATE_KEY_PREFIX = '_';

export type MatchFields = {
  title: string; map_id: string; map_rotation: string; game_type: string; max_players: number; password: string;
  gameplay_modifications: string; min_reputation: number; exclude_inactive_players: boolean; ping_limit: string;
  ping_limit_action: string; rounds_until_rotation: string; round_duration_str: string; round_duration: number;
  respawn_model: string; allow_vpn_guests: number; ranked: boolean; p2p: boolean; p2p_region: string; accept_connections_manually: boolean;
};

export const MATCH_DEFAULTS: Readonly<MatchFields> = Object.freeze({
  title: '',
  map_id: '',
  map_rotation: '',
  game_type: 'DM',
  max_players: 8,
  password: '',
  gameplay_modifications: '',
  min_reputation: 0,
  exclude_inactive_players: true,
  ping_limit: '',
  ping_limit_action: 'spectate',
  rounds_until_rotation: '15',
  round_duration_str: 'default',
  round_duration: 0,
  respawn_model: 'v2',
  allow_vpn_guests: 1,
  ranked: false,
  p2p: true,
  p2p_region: '',
  accept_connections_manually: false,
});

export const SERVER_DEFAULTS = Object.freeze({
  allow: Object.freeze([]),
  host_plays: false,
  local_map: '',
  region: '',
  udp_ports: '',
  ice_servers: Object.freeze([]),
  fps: 60,
  restart_after_s: 15,
});

export const DEFAULT_DURATION_WORDS: ReadonlySet<string> = new Set(['', 'default', 'auto']);
export const DURATION_UNIT_MS: Readonly<Record<string, number>> = Object.freeze({ hour: 3600000, minute: 60000, second: 1000 });
export const DURATION_PART = /^\s*(\d+(?:\.\d+)?)\s*(hour|minute|second)s?\s*/;
export const DECIMAL_COMMA = /,/g;
export const DECIMAL_POINT = '.';

export const PORT_RANGE_PATTERN = /^(\d+)\s*-\s*(\d+)$/;
export const SINGLE_PORT_PATTERN = /^(\d+)$/;
export const ICE_URL_PATTERN = /^(stun|stuns|turn|turns):/;
export const TURN_PREFIX = 'turn';
export const LOCAL_MAP_NAME = /^[A-Za-z0-9 _%-][A-Za-z0-9 _.%-]{0,79}$/;
export const LOCAL_MAP_PREFIX = /^local-/i;
export const MAP_FILE_EXTENSION = /\.(xml|txt)$/i;
export const LOGIN_PATTERN = /^[^\s]{1,40}$/;

export const CONFIG_FLAG = '--config';
export const CONFIG_FLAG_WITH_VALUE = '--config=';

export const PAGE_TAG = Object.freeze({ console: '[pb2dev] ', chat: '[chat] ' });
export const HTML_TAG = /<[^>]*>/g;
export const HTML_ENTITY = /&(lt|gt|amp|quot|#39|nbsp);/g;
export const HTML_ENTITIES: Readonly<Record<string, string>> = Object.freeze({ '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#39;': '\'', '&nbsp;': ' ' });
export const PATH_SEPARATOR = '/';
export const PAGE_ERROR_LEVEL = 'error';
export const MISSING_FILE_CODE = 'ENOENT';
export const TEXT_ENCODING = 'utf8';
export const BYTE_ORDER_MARK = /^\uFEFF/;

export const SCREEN = Object.freeze({ menu: 'menu', lobby: 'MPLobby' });
export const PHASE = Object.freeze({
  boot: 'starting the game',
  lobby: 'logging in to the lobby server',
  creating: 'creating the match',
  joining: 'joining the match',
  running: 'running',
  waiting: 'waiting to start again',
  stopped: 'stopped',
} as const);
export type Phase = typeof PHASE[keyof typeof PHASE];
export const LOCAL_MAP_ID_PREFIX = 'local-';
export const MAP_URL = '/pb2/server.php';
export const MAP_REQUEST_KIND = 'cmap';
export const MAP_START = '<';
export const PLAYER_START = /<player\b/g;
export const MAP_NOT_COMPRESSED = '0';
export const TIME_ZONE_SEPARATOR = '/';
export const REPLY_OK = 'ok';
export const KICK_DONE = 'successfully';
export const KICK_KEEP_OUT = '0';
export const OWNER_COMMAND = Object.freeze({
  terminate: '-terminate',
  pause: '-pause',
  swap: '-swap',
  endround: '-endround',
  unbanall: '-unbanall',
});
export const SLOT_PREFIX = /^#/;
export const DIGITS_ONLY = /^\d+$/;
export const PING_OFF = 'off';
export const LOCAL_WORD = 'local';
export const WORD_SEPARATOR = ' ';
export const NO_VALUE = '-';
export const WHO_COLUMNS: readonly string[] = Object.freeze(['slot', 'name', 'ping', 'team', 'hp', 'rep']);
export const COMMAND_NAME = Object.freeze({
  server: 'server',
  status: 'status',
  who: 'who',
  kick: 'kick',
  tell: 'tell',
  say: 'say',
  map: 'map',
  pause: 'pause',
  swap: 'swap',
  endround: 'endround',
  unbanall: 'unbanall',
  ping: 'ping',
  pingAction: 'ping_action',
  minReputation: 'min_reputation',
  stop: 'stop',
  start: 'start',
  restart: 'restart',
});
export const COMMAND_ALIASES = Object.freeze({
  status: Object.freeze(['info']),
  who: Object.freeze(['players']),
  tell: Object.freeze(['pm', 'whisper']),
  minReputation: Object.freeze(['minrep']),
});
export const SEE_ALSO_MAPS: readonly string[] = Object.freeze(['maps']);
