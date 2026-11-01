export const TEXT = Object.freeze({
  started: (args: readonly string[]) => `Smoke: electron ${args.join(' ')}`,
  launcher: 'Smoke: launcher open; playing the official server',
  gamePage: (url: string) => `Smoke: game page ${url}`,
  consoleReady: 'Smoke: dev console ready',
  command: (line: string) => `> ${line}`,
  timedOut: (what: string) => `Smoke: timed out waiting for ${what}`,
  waitingFor: Object.freeze({ debugger: 'the debugging port', launcher: 'the launcher', game: 'the game page', console: 'the dev console' }),
  cdpError: (message: string) => `DevTools protocol error: ${message}`,
});
