export const TEXT = Object.freeze({
  noAccount: (file: string) => `map bot: no account in ${file} ({ "login": "…", "password": "<md5 of the password>" }, as in data/credentials.json)`,
  badAccount: (file: string, message: string) => `map bot: ${file}: ${message}`,
  missingNames: (names: readonly string[]) => `map bot: the game's names are missing (${names.join(', ')}): npm run find-names`,
  buildChanged: (build: string) => `map bot: the game's build is no longer ${build}; the lobby may refuse the bot's login until LOBBY_CLIENT in src/features/map_bot/keys.ts follows it`,
  loginRefused: (reason: string) => `the official lobby refused the login: ${reason}`,
  createRefused: (reason: string) => `the official lobby did not create the match: ${reason}`,
  noMap: 'the official lobby sent no map in time',
  timedOut: 'the official lobby did not answer in time',
  ready: (login: string) => `Map bot: maps that are not here are fetched from the official lobby, as ${login}`,
  fetching: (id: string) => `Map bot: fetching ${id} from the official lobby`,
  taskIgnored: 'Map bot: the official lobby sent a task (code to run); the bot does not run it',
});
