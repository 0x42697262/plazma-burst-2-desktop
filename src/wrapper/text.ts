export const TEXT = Object.freeze({
  flagsFileUnreadable: (message: string) => `data/features.json cannot be read: ${message}`,
});

export const APP_TEXT = Object.freeze({
  gameMissing: (root: string, runFlag: string) => `No game files found in ${root}.\n\nRun "npm run fetch-game${runFlag}" first (see README.md).`,
  gameMissingTitle: (title: string) => `${title}: game files missing`,
  loginHidden: (names: readonly string[]) => `Private server: the official login is put aside (${names.join(', ')}) and comes back on the official server`,
  loginRestored: (names: readonly string[]) => `Official server: your login is back (${names.join(', ')})`,
  gameMenu: 'Game',
  unknownClient: (id: string) => `no game client "${id}" in this app`,
  notPrepared: (title: string, problems: readonly string[]) => [`${title}: its game files are not ready`, ...problems].join('\n'),
  cannotStart: 'Cannot start the game',
  modeOff: (id: string, reason: string | null) => `"${id}" is off${reason ? ` (${reason})` : ''}; not starting it.`,
  sadburstHostModes: (title: string) => `${title}: remote play and the player-hosted host are for the official client only.`,
  gameFrom: (prefix: string, version: string, root: string) => `${prefix}Game ${version} from ${root}`,
  settingsSeeded: (file: string) => `Wrote this app's default settings and binds to ${file}`,
  clientPrefix: (title: string) => `${title}: `,
  sadburstHooksOff: (title: string) => `${title}: hooks are off (its loader sends a hash of the game scripts with the login; docs/features/hooks.md).`,
  debugLevel: 'Log level: debug (requests, window events, the game\'s trace() output)',
  serversMenu: 'Servers',
  serverListItem: 'Server list',
  windowMenu: 'Window',
  notWatching: (file: string, message: string) => `Not watching ${file}: ${message}`,
});
