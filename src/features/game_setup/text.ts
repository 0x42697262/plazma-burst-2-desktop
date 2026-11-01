export const TEXT = Object.freeze({
  checking: 'Checking for a new game version…',
  offline: (version: string, message: string) => `Could not check for a new game version (${message}); playing the copy here (${version}).`,
  cannotDownload: (message: string) => `The game is not here yet, and it could not be downloaded: ${message}`,
  downloading: (version: string | null) => (version ? `Downloading the game, version ${version}…` : 'Downloading the game…'),
  newVersion: (local: string, latest: string) => `A new game version is out (${latest}; here: ${local}).`,
  findingNames: 'Finding the game\'s names…',
  namesMissing: (missing: readonly string[]) => `Some of the game's names were not found: ${missing.join(', ')}. Joining private servers is refused until they are.`,
  namesFailed: (message: string) => `The game's names could not be found (${message}). Joining private servers is refused until they are.`,
  windowTitle: (client: string) => `${client}: getting the game`,
  failedTitle: (client: string) => `${client}: the game could not be downloaded`,
});
