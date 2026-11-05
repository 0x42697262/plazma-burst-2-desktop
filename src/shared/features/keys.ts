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
  diagnostics: 'diagnostics',
});
export type FeatureId = typeof FEATURE[keyof typeof FEATURE];

export const MODE = Object.freeze({ local: 'local', remote: 'remote', server: 'server' });
export type Mode = typeof MODE[keyof typeof MODE];
export const ALL_MODES: readonly Mode[] = Object.freeze([MODE.local, MODE.remote, MODE.server]);

export const CLIENT = Object.freeze({ official: 'official', sadburst: 'sadburst' });
export type ClientId = typeof CLIENT[keyof typeof CLIENT];

export const FLAG_SOURCE = Object.freeze({ default: 'default', file: 'file', env: 'env', constraint: 'constraint', edition: 'edition' });
export type FlagSource = typeof FLAG_SOURCE[keyof typeof FLAG_SOURCE];

export const CAPABILITY_SEPARATOR = '.';
export const capabilityId = (feature: FeatureId, name: string): string => feature + CAPABILITY_SEPARATOR + name;

export const CAPABILITY = Object.freeze({
  diagnostics: Object.freeze({ capture: 'diagnostics.capture', show: 'diagnostics.show', send: 'diagnostics.send' }),
  p2pHost: Object.freeze({ status: 'p2p_host.status', who: 'p2p_host.who', kick: 'p2p_host.kick', tell: 'p2p_host.tell', say: 'p2p_host.say', map: 'p2p_host.map', pause: 'p2p_host.pause', swap: 'p2p_host.swap', endround: 'p2p_host.endround', unbanall: 'p2p_host.unbanall', ping: 'p2p_host.ping', pingAction: 'p2p_host.ping_action', minReputation: 'p2p_host.min_reputation', stop: 'p2p_host.stop', start: 'p2p_host.start', restart: 'p2p_host.restart' }),
  triggers: Object.freeze({ list: 'triggers.list', history: 'triggers.history', find: 'triggers.find', run: 'triggers.run', exec: 'triggers.exec', actions: 'triggers.actions', regions: 'triggers.regions', regionsRun: 'triggers.regions_run', vars: 'triggers.vars', varsSet: 'triggers.vars_set', varsSync: 'triggers.vars_sync', logic: 'triggers.logic', logicShow: 'triggers.logic_show', logicTree: 'triggers.logic_tree' }),
  serverList: Object.freeze({ list: 'server_list.list', connect: 'server_list.connect', add: 'server_list.add', edit: 'server_list.edit', remove: 'server_list.remove', fingerprint: 'server_list.fingerprint', page: 'server_list.page' }),
  profiles: Object.freeze({ status: 'profiles.status', list: 'profiles.list', show: 'profiles.show', use: 'profiles.use', set: 'profiles.set', bind: 'profiles.bind', onload: 'profiles.onload', delete: 'profiles.delete' }),
  netlog: Object.freeze({ status: 'netlog.status', show: 'netlog.show', runs: 'netlog.runs', all: 'netlog.all', record: 'netlog.record', state: 'netlog.state' }),
  scanBypass: Object.freeze({ status: 'scan_bypass.status', checks: 'scan_bypass.checks' }),
  fingerprint: Object.freeze({ run: 'fingerprint.run', list: 'fingerprint.list' }),
  mapCache: Object.freeze({ maps: 'map_cache.maps', saveMaps: 'map_cache.save_maps', fastMaps: 'map_cache.fast_maps' }),
  screenshot: Object.freeze({ screenshot: 'screenshot.screenshot', key: 'screenshot.key' }),
  gameChat: Object.freeze({ game: 'game_chat.game', builtin: 'game_chat.builtin' }),
  binds: Object.freeze({ bind: 'binds.bind', keyname: 'binds.keyname' }),
  guns: Object.freeze({ list: 'guns.list', give: 'guns.give', drop: 'guns.drop', gun: 'guns.gun', bullets: 'guns.bullets' }),
  playerInfo: Object.freeze({ pos: 'player_info.pos', chars: 'player_info.chars', uid: 'player_info.uid' }),
  health: Object.freeze({ god: 'health.god', hp: 'health.hp', heal: 'health.heal', revive: 'health.revive' }),
  movement: Object.freeze({
    speed: 'movement.speed', jump: 'movement.jump', gravity: 'movement.gravity', fly: 'movement.fly', swords: 'movement.swords', worldGravity: 'movement.world_gravity',
  }),
});


export const PAGE_CAPABILITIES_GLOBAL = 'PB2_CAPABILITIES';
export const FEATURE_OWNER = '0x42697262';
export const PAGE_FLAGS_GLOBAL = 'PB2_FEATURES';
