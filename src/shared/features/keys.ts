export const FEATURE = Object.freeze({
  devConsole: 'dev_console',
  consoleCore: 'console_core',
  profiles: 'profiles',
  teleport: 'teleport',
  playerInfo: 'player_info',
  health: 'health',
  movement: 'movement',
  guns: 'guns',
  binds: 'binds',
  triggers: 'triggers',
  trace: 'trace',
  mapEditor: 'map_editor',
  mapCache: 'map_cache',
  gameChat: 'game_chat',
  zoom: 'zoom',
  screenshot: 'screenshot',
  netlog: 'netlog',
  fingerprint: 'fingerprint',
  lobbyTaskGuard: 'lobby_task_guard',
  scanBypass: 'scan_bypass',
  jsEval: 'js_eval',
  hooks: 'hooks',
  serverList: 'server_list',
  login: 'login',
  certPinning: 'cert_pinning',
  remotePlay: 'remote_play',
  p2pHost: 'p2p_host',
  clientSadburst: 'client_sadburst',
  gameSetup: 'game_setup',
});
export type FeatureId = typeof FEATURE[keyof typeof FEATURE];

export const MODE = Object.freeze({ local: 'local', remote: 'remote', server: 'server' });
export type Mode = typeof MODE[keyof typeof MODE];
export const ALL_MODES: readonly Mode[] = Object.freeze([MODE.local, MODE.remote, MODE.server]);

export const CLIENT = Object.freeze({ official: 'official', sadburst: 'sadburst' });
export type ClientId = typeof CLIENT[keyof typeof CLIENT];

export const FLAG_SOURCE = Object.freeze({ default: 'default', file: 'file', env: 'env', constraint: 'constraint', edition: 'edition' });
export type FlagSource = typeof FLAG_SOURCE[keyof typeof FLAG_SOURCE];

export const FEATURE_OWNER = '0x42697262';
export const PAGE_FLAGS_GLOBAL = 'PB2_FEATURES';
