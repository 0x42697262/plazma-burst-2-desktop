export const RISKY_COMMANDS: readonly string[] = Object.freeze([
  'js', 'fingerprint', 'fp', 'wire', 'game', 'servers', 'server-list', 'diagnostics', 'diag', 'triggers', 'trigger', 'trig', 'bypass',
  'regions', 'region', 'vars', 'var', 'variables',
]);
export const SAFE_COMMANDS: readonly string[] = Object.freeze([
  'help', '?', 'list', 'ls', 'set', 'get', 'unset', 'del', 'rm', 'reset', 'more', 'next', 'page', 'pg', 'features', 'flags',
  'clear', 'cls', 'close', 'exit', 'netlog', 'net', 'packets', 'screenshot', 'ss', 'shot', 'zoom', 'freecam', 'fps', 'fly', 'builtin', 'trace', 'tracer',
  'track', 'profile', 'profiles', 'bind', 'binds', 'unbind', 'keyname', 'whichkey', 'keytest', 'guns', 'weapons', 'give', 'drop',
  'throw', 'tp', 'teleport', 'pos', 'where', 'chars', 'players', 'bots', 'uid', 'playeruid', 'puid', 'accounts', 'authids', 'ids',
  'hp', 'heal', 'revive', 'res', 'maps', 'hooks', 'hook', 'editor', 'edit', 'mapedit', 'logic', 'links',
]);
export const SECTION = Object.freeze({ binds: 'binds', toggleBinds: 'toggle_binds', profiles: 'profiles', onload: 'onload' });
export const CHAIN_SEPARATOR = ';';
export const WORDS = /\s+/;
export const LINE_BREAKS_AND_TABS = /[\s\u2028\u2029]+/g;
export const SPACE = ' ';
export const PUT_METHOD = 'PUT';
export const DIALOG_TYPE = 'warning';
export const TEXT_TYPE = 'text/plain; charset=utf-8';
export const CONTENT_TYPE_HEADER = 'Content-Type';
