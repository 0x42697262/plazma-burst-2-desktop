export const ENV = Object.freeze({
  gameDir: 'PB2_GAME_DIR',
  gameVersion: 'PB2_VERSION',
  devConsole: 'PB2_DEV',
  hooks: 'PB2_HOOKS',
  features: 'PB2_FEATURES',
  logLevel: 'PB2_LOG_LEVEL',
  logFormat: 'PB2_LOG_FORMAT',
  login: 'PB2_LOGIN',
  password: 'PB2_PASSWORD',
  uid: 'PB2_UID',
  npmSadburst: 'npm_config_sadburst',
});

export const ARG = Object.freeze({
  sadburst: '--sadburst',
  remoteHost: '--host',
  p2pHost: '--p2p-host',
  verbose: '--verbose',
  verboseShort: '-v',
  logLevel: '--log-level',
  logLevelPrefix: '--log-level=',
  logFormatPrefix: '--log-format=',
  listFeatures: '--features',
});
