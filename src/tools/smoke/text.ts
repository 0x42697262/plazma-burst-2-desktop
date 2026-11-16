export const TEXT = Object.freeze({
  started: (args: readonly string[]) => `Smoke: electron ${args.join(' ')}`,
  launcher: 'Smoke: launcher open; playing the chosen client\'s own servers',
  gamePage: (url: string) => `Smoke: game page ${url}`,
  playFailed: (answer: string) => `Smoke: Play did not start the game: ${answer}`,
  levelOfficialOnly: 'Smoke: --level starts a level in the official client only; the Sad Burst clients start a map through their difficulty screen, which smoke cannot press yet',
  levelStarted: 'Smoke: level started from the map file',
  consoleReady: 'Smoke: dev console ready',
  gameStarted: 'Smoke: entered as a guest; the game\'s scripts are running',
  command: (line: string) => `> ${line}`,
  timedOut: (what: string) => `Smoke: timed out waiting for ${what}`,
  waitingFor: Object.freeze({ debugger: 'the debugging port', launcher: 'the launcher', game: 'the game page', console: 'the dev console', gameScripts: 'the game\'s scripts', level: 'the level' }),
  cdpError: (message: string) => `DevTools protocol error: ${message}`,
});
