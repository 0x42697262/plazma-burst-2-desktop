export const MODIFIER_BIT = Object.freeze({ shift: 1, ctrl: 2, alt: 4, meta: 8 });
export const MAX_KEY_TEXT = 32;
export const NO_MODIFIERS = 0;
export const TESTER_NAME_COLUMN = 20;

export const TOKEN_BYTES = 24;
export const TESTERS_FILE_VERSION = 1;
export const TESTERS_FILE_MODE = 0o600;

export const HELLO_TIMEOUT_MS = 5000;
export const PING_MS = 20000;
export const MAX_PAYLOAD_BYTES = 4096;
export const MAX_INPUT_PER_SECOND = 600;
export const MAX_BUFFERED_BYTES = 1.5e6;
export const WRONG_LINKS_MAX = 10;
export const WRONG_LINKS_WINDOW_MS = 60000;
export const CLOSE_REASON_LENGTH = 120;
export const MILLISECONDS_PER_SECOND = 1000;

export const CLOSE = Object.freeze({ badToken: 4001, replaced: 4002, full: 4003, gone: 4004, protocol: 4005 });

export const HOST_DEFAULTS = Object.freeze({ port: 8787, bind: '127.0.0.1', maxGames: 4, fps: 30, idleMs: 120000, quality: 60, width: 960, height: 540 });
export const HOST_LIMITS = Object.freeze({
  port: Object.freeze({ min: 1, max: 65535 }),
  max: Object.freeze({ min: 1, max: 64 }),
  fps: Object.freeze({ min: 1, max: 60 }),
  quality: Object.freeze({ min: 10, max: 100 }),
  width: Object.freeze({ min: 320, max: 1920 }),
  height: Object.freeze({ min: 180, max: 1080 }),
});

export const REMOTE_WEB_PREFERENCES = Object.freeze({
  devTools: false,
  spellcheck: false,
  webviewTag: false,
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  backgroundThrottling: false,
});

export const CLIENT_RECONNECT_MS = 2000;
export const CLIENT_LINE_PX = 40;
export const CLIENT_STATUS_MS = 1000;
export const DOM_DELTA = Object.freeze({ pixel: 0, line: 1, page: 2 });
export const DOM_BUTTONS: ReadonlySet<number> = new Set([0, 1, 2]);
