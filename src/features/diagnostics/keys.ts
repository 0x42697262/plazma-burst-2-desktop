export const COMMAND = Object.freeze({ name: 'diagnostics', aliases: ['diag'] });

export const REPORT_KIND = Object.freeze({
  pageError: 'page_error', unhandledRejection: 'unhandled_rejection', rendererCrash: 'renderer_crash', mainError: 'main_error', manual: 'manual',
});
export const REPORT_KINDS = Object.freeze(Object.values(REPORT_KIND)) as readonly [string, ...string[]];

export const ROUTE_OP = Object.freeze({ report: 'report', manual: 'manual', clear: 'clear' });
export const REPORT_QUERY = 'report';
export const LAST_WORD = 'last';
export const REPORTS_FILE = 'reports.json';
export const CLEAN_EXIT = 'clean-exit';
export const UNCAUGHT_MONITOR = 'uncaughtExceptionMonitor';
export const PAGE_EVENT = Object.freeze({ error: 'error', rejection: 'unhandledrejection' });
export const NUMBER_WORD = /^\d+$/;

export const REPLACEMENT = Object.freeze({ secret: '$1\u2039redacted\u203a', path: '~/', address: '\u2039address\u203a', digest: '\u2039redacted\u203a' });
export const SECRET_PAIR = /\b((?:password|passwd|pass|token|auth_token|game_token|pb2uid|cookie|authorization|set-cookie)["']?\s*[:=]\s*(?:bearer\s+)?["']?)[^\s"'&;,]+/gi;
export const BEARER = /\b(bearer\s+)[A-Za-z0-9._~+/=-]+/gi;
export const MD5_DIGEST = /\b[0-9a-f]{32}\b/gi;
export const HOME_PATH = /(?:\/(?:home|Users)\/[^/\s"']+\/|[A-Za-z]:\\Users\\[^\\\s"']+\\)/g;
export const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
export const IPV6 = /(?<![\w:])(?=[0-9a-f:]*(?:::|(?::[0-9a-f]*){4}))[0-9a-f:]{2,39}(?![\w:])/gi;
