export const DEBUG_PORT = 9333;
export const DEBUG_HOST = '127.0.0.1';
export const TARGET_LIST_URL = `http://${DEBUG_HOST}:${DEBUG_PORT}/json/list`;
export const PAGE_TARGET_TYPE = 'page';
export const LAUNCHER_URL_SUFFIX = 'desktop/launcher/index.html';
export const GAME_URL_PREFIX = 'https://';
export const BOOT_TIMEOUT_MS = 90_000;
export const POLL_MS = 500;
export const SETTLE_MS = 1_500;
export const CONSOLE_LINE_PREFIX = '[pb2dev] ';
export const DEFAULT_COMMANDS = Object.freeze(['help']);
export const COMMAND_FLAG = '--run';
export const ELECTRON_ARGS_FLAG = '--';
export const ELECTRON_BIN = 'node_modules/.bin/electron';
export const DEBUG_PORT_SWITCH = `--remote-debugging-port=${DEBUG_PORT}`;
export const PLAY_OFFICIAL_EXPRESSION = 'pb2servers.list().then((data) => pb2servers.play(data.official.id)).then(() => true)';
export const CONSOLE_READY_EXPRESSION = 'typeof globalThis.pb2dev === "object" && globalThis.pb2dev !== null';
export const runCommandExpression = (line: string): string => `globalThis.pb2dev.run(${JSON.stringify(line)})`;
export const CDP = Object.freeze({
  evaluate: 'Runtime.evaluate',
  enableRuntime: 'Runtime.enable',
  consoleCalled: 'Runtime.consoleAPICalled',
});
export const APP_DIR = '.';
export const CONSOLE_ARGUMENT_SEPARATOR = ' ';
export const SOCKET_MESSAGE_EVENT = 'message';
export const CLI_ARGS_START = 2;
