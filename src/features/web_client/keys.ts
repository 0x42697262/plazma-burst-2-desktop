export const ROUTE = Object.freeze({
  join: '/',
  play: '/play/',
  devPrefix: '__dev/',
  names: 'names.js',
  page: 'page/',
});
export const URL_BASE = 'http://localhost';
export const ERROR_JOIN = ' ';
export const GET_METHOD = 'GET';
export const POST_METHOD = 'POST';
export const INDEX_FILE = 'index.html';
export const VERSION_FILE = 'pb2-version.json';
export const TEXT_ENCODING = 'utf8';
export const SERVER_NAME_MARK = '{{server-name}}';
export const FORM_FIELD = Object.freeze({ nickname: 'nickname', password: 'password' });
export const HEADER = Object.freeze({
  contentType: 'Content-Type',
  cache: 'Cache-Control',
  location: 'Location',
  policy: 'Content-Security-Policy',
  noSniff: 'X-Content-Type-Options',
  referrer: 'Referrer-Policy',
  host: 'host',
});
export const NO_SNIFF = 'nosniff';
export const NO_REFERRER = 'no-referrer';
export const NO_STORE = 'no-store';
export const CACHE_GAME_FILES = 'public, max-age=3600';
export const HTML_TYPE = 'text/html; charset=utf-8';
export const TEXT_TYPE = 'text/plain; charset=utf-8';
export const SCRIPT_TYPE = 'text/javascript; charset=utf-8';
export const BINARY_TYPE = 'application/octet-stream';
export const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.html': HTML_TYPE,
  '.js': SCRIPT_TYPE,
  '.mjs': SCRIPT_TYPE,
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': TEXT_TYPE,
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.map': 'application/json',
});
export const GAME_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
export const JOIN_POLICY = ["default-src 'none'", "style-src 'unsafe-inline'", "form-action 'self'", "frame-ancestors 'none'", "base-uri 'none'"].join('; ');
export const HTML_ESCAPES: Readonly<Record<string, string>> = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });
export const HTML_SPECIAL = /[&<>"']/g;
export const PATH_PARENT = '..';
export const PATH_SEPARATORS = /[\\/]+/;
export const HIDDEN_PREFIX = '.';
export const QUERY_START = '?';
export const DEFAULT_HTTPS_PORT = '443';
export const PORT_SEPARATOR = ':';

export const JOIN_PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{server-name}}</title>
<style>
  :root { color-scheme: light dark; --bg: #f4f4f5; --card: #ffffff; --text: #18181b; --muted: #52525b; --line: #d4d4d8; --accent: #2563eb; }
  @media (prefers-color-scheme: dark) { :root { --bg: #18181b; --card: #27272a; --text: #f4f4f5; --muted: #a1a1aa; --line: #3f3f46; --accent: #60a5fa; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--text); font: 16px/1.5 system-ui, sans-serif; padding: 16px; }
  form { width: 100%; max-width: 360px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 24px; display: grid; gap: 14px; }
  h1 { margin: 0; font-size: 1.25rem; }
  p { margin: 0; color: var(--muted); font-size: 0.9rem; }
  label { display: grid; gap: 4px; font-size: 0.9rem; }
  input { font: inherit; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: transparent; color: inherit; }
  button { font: inherit; padding: 10px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; cursor: pointer; }
</style>
</head>
<body>
<form method="post" action="play/">
  <h1>{{server-name}}</h1>
  <p>Plazma Burst 2 in your browser. Then open Multiplayer.</p>
  <label>Nickname <input name="nickname" required maxlength="20" autocomplete="nickname" autofocus></label>
  <label>Password <input name="password" type="password" maxlength="200" autocomplete="current-password" placeholder="Only if the server or your admin nickname has one"></label>
  <button type="submit">Play</button>
</form>
</body>
</html>
`;
