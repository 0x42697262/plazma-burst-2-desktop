export const TESTERS_FILE_NAME = 'remote-testers.json';
export const TESTER_SETTINGS_FILE_NAME = 'dev-overrides.json';
export const PARTITION_PREFIX = 'persist:remote-';
export const SCALE_FACTOR_SWITCH = 'force-device-scale-factor';
export const SCALE_FACTOR_ONE = '1';

export const WS_PATH = '/ws';
export const URL_BASE = 'http://localhost';
export const WS_SCHEME = Object.freeze({ secure: 'wss:', plain: 'ws:' });
export const SECURE_PAGE_SCHEME = 'https:';
export const AUTHORITY_START = '//';
export const TOKEN_PARAMETER = 't';

export const MESSAGE = Object.freeze({
  hello: 'hello',
  ready: 'ready',
  error: 'error',
  keyDown: 'kd',
  keyUp: 'ku',
  mouseMove: 'mm',
  mouseDown: 'md',
  mouseUp: 'mu',
  wheel: 'wh',
} as const);
export type MessageType = typeof MESSAGE[keyof typeof MESSAGE];

export const INPUT_EVENT = Object.freeze({
  keyDown: 'keyDown',
  keyUp: 'keyUp',
  char: 'char',
  mouseMove: 'mouseMove',
  mouseDown: 'mouseDown',
  mouseUp: 'mouseUp',
  mouseWheel: 'mouseWheel',
} as const);

export const MODIFIER_NAME = Object.freeze({ shift: 'shift', control: 'control', alt: 'alt', meta: 'meta', autoRepeat: 'isAutoRepeat' } as const);
export const BUTTON_NAMES: readonly string[] = Object.freeze(['left', 'middle', 'right']);
export const EMPTY_KEY = '';
export const FIRST_PRINTABLE = ' ';

export const ELECTRON_KEY_NAMES: Readonly<Record<string, string>> = Object.freeze({
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: '\'', Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\',
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', Tab: 'Tab',
  Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', ControlRight: 'Control',
  AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Meta', MetaRight: 'Meta', CapsLock: 'Capslock',
  NumLock: 'Numlock', ScrollLock: 'Scrolllock', PrintScreen: 'PrintScreen',
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
});
export const KEY_CODE_PATTERN = Object.freeze({
  letter: /^Key([A-Z])$/,
  digit: /^Digit([0-9])$/,
  numpad: /^Numpad([0-9])$/,
  functionKey: /^F([1-9]|1[0-9]|2[0-4])$/,
});
export const NUMPAD_PREFIX = 'num';

export const BLOCKED_KEY = Object.freeze({
  paste: 'v',
  pasteCode: 'KeyV',
  insert: 'insert',
  insertCode: 'Insert',
  devTools: Object.freeze(['i', 'j', 'c']),
  hostTools: Object.freeze(['u', 'p', 's', 'o']),
});

export const TESTER_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
export const TOKEN_ENCODING = 'base64url';
export const TOKEN_HASH = 'sha256';

export const LOOPBACK_ADDRESSES: ReadonlySet<string> = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export const FORWARD_HEADER = Object.freeze({ cloudflare: 'cf-connecting-ip', forwardedFor: 'x-forwarded-for' });
export const FORWARD_SEPARATOR = ',';
export const UNKNOWN_ADDRESS = '?';
export const PUBLIC_BIND = '0.0.0.0';
export const LOCAL_HOST_NAME = 'localhost';

export const HOST_ARG_PATTERN = /^--(port|bind|max|fps|quality|size)=(.+)$/;
export const SIZE_PATTERN = /^(\d+)x(\d+)$/;
export const PUBLIC_FLAG = '--public';
export const HOST_ARG = Object.freeze({ port: 'port', bind: 'bind', max: 'max', fps: 'fps', quality: 'quality', size: 'size' } as const);

export const TESTERS_COMMAND = Object.freeze({ add: 'add', remove: 'remove', list: 'list' } as const);

export const CLIENT_FILES: Readonly<Record<string, Readonly<{ file: string; type: string }>>> = Object.freeze({
  '/': Object.freeze({ file: 'index.html', type: 'text/html; charset=utf-8' }),
  '/client.js': Object.freeze({ file: 'client.js', type: 'text/javascript; charset=utf-8' }),
  '/client.css': Object.freeze({ file: 'client.css', type: 'text/css; charset=utf-8' }),
});
export const CLIENT_STATIC_FILES: readonly string[] = Object.freeze(['index.html', 'client.css']);
export const CLIENT_SCRIPT_FILE = 'client.js';
export const CONTENT_TYPE_HEADER = 'Content-Type';
export const RESPONSE_HEADERS: Readonly<Record<string, string>> = Object.freeze({
  'Content-Security-Policy': 'default-src \'none\'; script-src \'self\'; style-src \'self\'; img-src \'self\' blob: data:; connect-src \'self\'; base-uri \'none\'; form-action \'none\'; frame-ancestors \'none\'',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
});

export const SOCKET_EVENT = Object.freeze({
  message: 'message',
  close: 'close',
  error: 'error',
  pong: 'pong',
  connection: 'connection',
} as const);

export const PAGE_LOAD_DESTINATIONS: ReadonlySet<string> = new Set(['document', 'iframe', 'frame', 'embed', 'object']);
export const FETCH_DEST_HEADER = 'sec-fetch-dest';

export const REMOTE_PAGE_SCRIPT = '<script>(() => {'
  + 'Object.defineProperty(globalThis, "PB2_REMOTE", { value: true });'
  + 'const stop = (event) => { event.preventDefault(); event.stopImmediatePropagation(); };'
  + 'for (const type of ["paste", "copy", "cut"]) window.addEventListener(type, stop, true);'
  + 'try { for (const method of ["read", "readText", "write", "writeText"]) Object.defineProperty(navigator.clipboard, method, { value: () => Promise.reject(new Error("not in remote play")) }); } catch {}'
  + '})();</script>';

export const WINDOW_EVENT = Object.freeze({
  download: 'will-download',
  navigate: 'will-navigate',
  redirect: 'will-redirect',
  attachWebview: 'will-attach-webview',
  devtoolsOpened: 'devtools-opened',
  beforeInput: 'before-input-event',
} as const);
export const WINDOW_OPEN_DENIED = Object.freeze({ action: 'deny' } as const);

export const CLIENT_ELEMENT = Object.freeze({
  screen: 'screen',
  overlay: 'overlay',
  message: 'message',
  play: 'play',
  status: 'status',
  fullscreen: 'fullscreen',
});
export const CLIENT_CONTEXT_2D = '2d';
export const BLOB_BINARY_TYPE = 'blob';
export const PIXEL_UNIT = 'px';

export const BROWSER_EVENT = Object.freeze({
  keyDown: 'keydown',
  keyUp: 'keyup',
  blur: 'blur',
  visibility: 'visibilitychange',
  pointerMove: 'pointermove',
  pointerDown: 'pointerdown',
  pointerUp: 'pointerup',
  wheel: 'wheel',
  contextMenu: 'contextmenu',
  click: 'click',
  resize: 'resize',
} as const);

export const REDACTION_PATTERN = Object.freeze({
  path: /(?:\.{0,2}\/)?\b(?:data|desktop|docs|hooks|tools|test|game|game\.previous|scripts|screenshots|node_modules|src|dist|__dev|__hooks)\/(?:[^\s"'`)\],;]*[^\s"'`)\],;.:])?/g,
  file: /\b[\w.*-]+\.(?:md|js|mjs|cjs|json|ts)\b/g,
  escaped: /\$?(?:[0-9A-Za-z_$]|\\u[0-9a-fA-F]{4})*\\u04[0-9a-fA-F]{2}(?:[0-9A-Za-z_$]|\\u[0-9a-fA-F]{4})*/g,
  specialCharacters: /[.*+?^${}()|[\]\\]/g,
});
export const IDENTIFIER_CHARACTERS = '0-9A-Za-z_$\\u0400-\\u04FF';
export const CYRILLIC_CHARACTERS = '\\u0400-\\u04FF';
export const OBFUSCATED_PREFIX = '$';
export const ESCAPED_MATCH = '\\$&';
export const ALTERNATIVE = '|';
export const GLOBAL_FLAG = 'g';
export const obfuscatedPattern = (): RegExp => new RegExp(`\\$[${IDENTIFIER_CHARACTERS}]*[${CYRILLIC_CHARACTERS}][${IDENTIFIER_CHARACTERS}]*`, GLOBAL_FLAG);
export const exactNamesPattern = (escapedNames: readonly string[]): RegExp => new RegExp(`(?:${escapedNames.join(ALTERNATIVE)})(?![${IDENTIFIER_CHARACTERS}])`, GLOBAL_FLAG);
