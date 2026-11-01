import { TESTER_NAME_COLUMN } from './constants.ts';

export const HIDDEN = '‹hidden›';

export const TEXT = Object.freeze({
  badTesterName: 'a tester name is 1-32 letters, digits, "-" or "_", starting with a letter or digit',
  badWholeNumber: (name: string, min: number, max: number) => `--${name} must be a whole number from ${min} to ${max}`,
  badSize: (minWidth: number, minHeight: number, maxWidth: number, maxHeight: number) => `--size must be WIDTHxHEIGHT, from ${minWidth}x${minHeight} to ${maxWidth}x${maxHeight}`,
  notFound: 'Not found',
  notAvailable: 'Not available',
  tooManyWrongLinks: 'Too many wrong links. Wait a minute.',
  invalidLink: 'This link is not valid. Ask the host for a new one.',
  full: (maxGames: number) => `The host is full (${maxGames} players). Try again later.`,
  gameStopped: 'The game stopped. Reload this page to start a new one.',
  gameNotStarted: 'The game could not start. Tell the host.',
  openedElsewhere: 'This game was opened somewhere else.',
  openedElsewhereReason: 'opened somewhere else',
  noHello: 'No hello.',
  expectedHello: 'Expected hello.',
  hostError: 'Host error.',
  notInRemotePlay: 'not in remote play',
  windowTitle: (name: string) => `Plazma Burst 2 (${name})`,
});

export const LOG = Object.freeze({
  gameClosed: (name: string, why: string) => `[remote] ${name}: game closed (${why})`,
  idleClose: (seconds: number) => `nobody connected for ${seconds} s`,
  hostStopped: 'host stopped',
  processEnded: 'the game process ended',
  wrongLink: (address: string) => `[remote] wrong link from ${address}`,
  wrongLinkLimit: (address: string, count: number, seconds: number) => `[remote] wrong link from ${address} (${count} times: refused for ${seconds} s)`,
  refusedFull: (name: string, maxGames: number) => `[remote] ${name}: refused, ${maxGames} games already running`,
  notStarted: (name: string, message: string) => `[remote] ${name}: could not start a game: ${message}`,
  started: (name: string, count: number, maxGames: number) => `[remote] ${name}: game started (${count}/${maxGames})`,
  connected: (name: string) => `[remote] ${name}: connected`,
  disconnected: (name: string) => `[remote] ${name}: disconnected`,
  serverError: (message: string) => `[remote] server: ${message}`,
  dropped: (message: string) => `[remote] connection dropped: ${message}`,
  welcomeFailed: (detail: string) => `[remote] ${detail}`,
  argProblem: (problem: string) => `Host: ${problem}`,
  listening: (bind: string, port: number, width: number, height: number, fps: number, quality: number, maxGames: number) =>
    `Remote play: listening on ${bind}:${port} (${width}x${height}, ${fps} fps, JPEG quality ${quality}, up to ${maxGames} games)`,
  linkHint: (local: string) => `Remote play: testers open their link, e.g. ${local}/#t=<token>. Add one: npm run testers -- add <name>`,
  localOnly: 'Remote play: only this machine can connect. For the internet, use a tunnel (docs/operations/remote-play.md) or --public.',
  cannotListen: (bind: string, port: number, message: string) => `Remote play: could not listen on ${bind}:${port}: ${message}`,
  flagOff: 'Remote play is off (feature flag "remote_play"); not starting the host.',
  notMarked: 'Remote play: could not mark index.html as remote (no <script> tag); not serving it',
  localAddress: (bind: string, port: number) => `http://${bind}:${port}`,
});

export const CLI_TEXT = Object.freeze({
  usage: 'usage: npm run testers -- add <name> | remove <name> | list',
  added: (name: string) => `Tester "${name}" added. Their personal link (send it privately):`,
  link: (token: string) => `  <your address>/#t=${token}`,
  linkExample: 'e.g. http://localhost:8787/#t=... on this machine, or your tunnel\'s https://... address.',
  linkWarning: 'Anyone with the link can play as them; "remove" makes it stop working.',
  removed: (name: string) => `Tester "${name}" removed; their link no longer works.`,
  noSuchTester: (name: string) => `No tester "${name}".`,
  noTesters: 'No testers. Add one: npm run testers -- add <name>',
  testerRow: (name: string, added: string) => `  ${name.padEnd(TESTER_NAME_COLUMN)} added ${added}`,
  error: (message: string) => `error: ${message}`,
});

export const CLIENT_TEXT = Object.freeze({
  connected: 'Connected.',
  hostClosed: 'The host closed the connection.',
  reconnecting: 'Connection lost. Reconnecting...',
  needsLink: 'This page needs your personal link from the host (it ends with #t=...).',
  status: (name: string, frames: number) => `${name} · ${frames} fps`,
  noStatus: '',
});
