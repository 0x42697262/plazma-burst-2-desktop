export const TEXT_ENCODING = 'utf8';
export const EMPTY_OBJECT_TEXT = '{}';
export const LINE_END = '\n';

export const MAIN_SCRIPT_TAG = '<script src="scripts/main.js"></script><script>//# sourceURL=scripts/main.js</script>';
export const FLASH_SCRIPT_TAG = '<script src="scripts/flash.js"></script>';
export const TRACE_SCRIPT_TAG = '<script>trace = console.debug.bind(console, "[trace]");</script>';
export const SERVER_TRACE_SCRIPT_TAG = '<script>trace = function (...a) {'
  + ' if (/\\bChatNewMsg\\b/.test(new Error().stack || "")) console.log("[chat] " + a[0]); else console.debug("[trace]", ...a); };</script>';
export const BODY_END = /<\/body>/i;
export const BODY_END_TAG = '</body>';
export const FIRST_SCRIPT = /<script\b/i;
export const SCRIPT_END_ESCAPE = /</g;
export const ESCAPED_LESS_THAN = '\\u003c';
export const PAGE_GLOBAL_SCRIPT = (name: string, json: string): string => `<script>Object.defineProperty(globalThis, ${JSON.stringify(name)}, { value: Object.freeze(${json}) });</script>`;
export const SERVER_PAGE_GLOBAL = 'PB2_SERVER';
export const JOIN_PAGE_GLOBAL = 'PB2_JOIN';
export const scriptTag = (source: string): string => `<script src="${source}"></script>`;
export const moduleScriptTag = (source: string): string => `<script type="module" src="${source}"></script>`;

export const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.map': 'application/json',
});
export const HTML_TYPE = 'text/html; charset=utf-8';
export const SCRIPT_TYPE = 'text/javascript; charset=utf-8';
export const JSON_TYPE = 'application/json';
export const BINARY_TYPE = 'application/octet-stream';
export const CONTENT_TYPE_HEADER = 'Content-Type';
export const CACHE_HEADER = 'Cache-Control';
export const NO_STORE = 'no-store';
export const INDEX_FILE = 'index.html';
export const FOLDER_END = '/';
export const PARENT_FOLDER = '..';
export const PUT_METHOD = 'PUT';
export const OK_BODY = 'ok';
export const VERSION_FILE = 'pb2-version.json';
export const KEPT_FILE = 'kept.txt';
export const LINES = /\r?\n/;
export const HTML_CONTENT = /text\/html/;
export const HTML_FILE = /\.html?$/;
export const NAMES_FALLBACK = 'globalThis.PB2_NAMES = null; console.error("names.js missing: run npm run find-names");';
export const OPCODES_FALLBACK = 'globalThis.PB2_OPCODES = null;';
export const ASSET_VERSION_FILE = 'asset-version.txt';
export const NAMES_VERSION = /^\s*version:\s*"([^"]*)"/m;
export const NAMES_NOT_FOUND = /NOT FOUND/;
export const PAGE_LEVEL: Readonly<Record<string, 'error' | 'warn' | 'info' | 'debug'>> = Object.freeze({
  error: 'error', warning: 'warn', info: 'info', log: 'info', debug: 'debug', verbose: 'debug',
});
export const DEFAULT_PAGE_LEVEL = 'info';
export const WINDOW_EVENT = Object.freeze({
  consoleMessage: 'console-message',
  failLoad: 'did-fail-load',
  processGone: 'render-process-gone',
  unresponsive: 'unresponsive',
  responsive: 'responsive',
  navigate: 'did-navigate',
  finishLoad: 'did-finish-load',
  paint: 'paint',
  closed: 'closed',
} as const);
export const HTTPS_SCHEME = 'https';
export const QUIT_WORDS = /^(quit|exit)$/i;
export const STOP_SERVER_SCRIPT = 'globalThis.pb2dev && pb2dev.run("server stop")';
export const runConsoleLineScript = (line: string): string => `globalThis.pb2dev ? (pb2dev.run(${JSON.stringify(line)}), true) : false`;
export const callConsoleScript = (method: string, argument: unknown): string => `globalThis.pb2dev && pb2dev.${method}(${JSON.stringify(argument)})`;
export const LINE_EVENT = 'line';
export const CLOSE_EVENT = 'close';
export const INTERRUPT_SIGNAL = 'SIGINT';
