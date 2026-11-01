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
