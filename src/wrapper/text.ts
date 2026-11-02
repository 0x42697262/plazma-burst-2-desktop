export const TEXT = Object.freeze({
  flagsFileUnreadable: (message: string) => `data/features.json cannot be read: ${message}`,
});

export const APP_TEXT = Object.freeze({
  gameMissing: (root: string, runFlag: string) => `No game files found in ${root}.\n\nRun "npm run fetch-game${runFlag}" first (see README.md).`,
  gameMissingTitle: (title: string) => `${title}: game files missing`,
  loginHidden: (names: readonly string[]) => `Private server: the official login is put aside (${names.join(', ')}) and comes back on the official server`,
  loginRestored: (names: readonly string[]) => `Official server: your login is back (${names.join(', ')})`,
  gameMenu: 'Game',
  modeOff: (id: string, reason: string | null) => `"${id}" is off${reason ? ` (${reason})` : ''}; not starting it.`,
  sadburstHostModes: 'Sad Burst 2: remote play and the player-hosted host are for the official client only.',
  gameFrom: (prefix: string, version: string, root: string) => `${prefix}Game ${version} from ${root}`,
  settingsSeeded: (file: string) => `Wrote this app's default settings and binds to ${file}`,
  clientPrefix: (title: string) => `${title}: `,
  sadburstHooksOff: 'Sad Burst 2: hooks are off (its loader sends a hash of the game scripts with the login; docs/features/hooks.md).',
  debugLevel: 'Log level: debug (requests, window events, the game\'s trace() output)',
  serversMenu: 'Servers',
  serverListItem: 'Server list',
  windowMenu: 'Window',
  notWatching: (file: string, message: string) => `Not watching ${file}: ${message}`,
});
