export const COMMAND = Object.freeze({ name: 'diagnostics', aliases: ['diag'] });

export const REPORT_KIND = Object.freeze({
  pageError: 'page_error', unhandledRejection: 'unhandled_rejection', rendererCrash: 'renderer_crash', mainError: 'main_error', manual: 'manual',
});
export const REPORT_KINDS = Object.freeze(Object.values(REPORT_KIND)) as readonly [string, ...string[]];

export const ROUTE_OP = Object.freeze({ report: 'report', manual: 'manual', clear: 'clear', send: 'send', preview: 'preview' });
export const REPORT_QUERY = 'report';
export const KEY_SEPARATOR = ':';
export const DEFAULT_KID = 'default';
export const CIPHER = 'aes-256-gcm';
export const HKDF_HASH = 'sha256';
export const KDF_INFO = 'pb2-diag';
export const ENCODING = Object.freeze({ utf8: 'utf8', base64: 'base64', hex: 'hex' });
export const KEY_FORMAT = Object.freeze({ x25519: 'x25519', der: 'der', spki: 'spki', pkcs8: 'pkcs8' });
export const DER_PREFIX = Object.freeze({ publicKey: '302a300506032b656e032100', privateKey: '302e020100300506032b656e04220420' });
export const SEALED_FIELD = Object.freeze({ kid: 'k', ephemeral: 'e', iv: 'n', ciphertext: 'c' } as const);
export const LAST_WORD = 'last';
export const REPORTS_FILE = 'reports.json';
export const CONFIG_FILE = 'diagnostics.json';
export const CONTENT_TYPE = Object.freeze({ 'Content-Type': 'application/json' });
export const SECURE_PROTOCOL = 'https:';
export const LOOPBACK_PROTOCOL = 'http:';
export const LOOPBACK_HOSTS: readonly string[] = Object.freeze(['localhost', '127.0.0.1', '[::1]']);
export const CLEAN_EXIT = 'clean-exit';
export const UNCAUGHT_MONITOR = 'uncaughtExceptionMonitor';
export const PAGE_EVENT = Object.freeze({ error: 'error', rejection: 'unhandledrejection' });
export const NUMBER_WORD = /^\d+$/;

export const REPLACEMENT = Object.freeze({ secret: '$1\u2039redacted\u203a', path: '~/', digest: '\u2039redacted\u203a' });
export const HOME_PATH = /(?:\/(?:home|Users)\/[^/\s"']+\/|[A-Za-z]:\\Users\\[^\\\s"']+\\)/g;
