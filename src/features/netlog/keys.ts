export const SOCKET_MESSAGE_EVENT = 'm';
export const TAP_OWNER = 'netlog';
export const WRAP_SYMBOL_NAME = 'pb2dev netlog wrapper';
export const SOCKET_EMIT_METHOD = 'emit';
export const PEER_SEND_METHOD = 'send';
export const PAGE_HIDE_EVENT = 'pagehide';

export const LINE_KIND = Object.freeze({ conn: 'CONN', rel: 'REL', state: 'STATE', packet: 'PKT', loss: 'LOSS', stat: 'STAT', page: 'PAGE' });
export type LineKind = typeof LINE_KIND[keyof typeof LINE_KIND];

export const DIRECTION = Object.freeze({ out: 'OUT', in: 'IN', none: '---' });
export type Direction = typeof DIRECTION[keyof typeof DIRECTION];

export const CONNECTION_KIND = Object.freeze({ server: 'server', p2pHost: 'p2p-host', p2pGuest: 'p2p-guest', socket: 'socket' });
export type ConnectionKind = typeof CONNECTION_KIND[keyof typeof CONNECTION_KIND];

export const STATE_KIND = Object.freeze({ player: 'player', snapshot: 'snapshot' });
export type StateKind = typeof STATE_KIND[keyof typeof STATE_KIND];

export const MESSAGE_TYPE = Object.freeze({
  response: 'RESPONSE',
  respawn: 'RESPAWN',
  ressurect: 'RESSURECT',
  healPlayer: 'HEAL_PLAYER',
  hitPlayer: 'HIT_PLAYER',
  authenticate: 'AUTHENTICATE',
  joinMatch: 'JOIN_MATCH',
  createMatch: 'CREATE_MATCH',
});
export const TYPE_PREFIX = 'RELIABLE_';
export const UNKNOWN_TYPE_PREFIX = 'TYPE_';
export const UNKNOWN_MARK = '?';
export const NO_CONNECTION = '--';
export const PASSWORD_FIELD = 'password';

export const SNAPSHOT_WAITING_PREFIX = '~~';
export const SNAPSHOT_PAUSED_PREFIX = '~';
export const SNAPSHOT_HEADER_PREFIX = /^~~?/;
export const STATE_LIST_SEPARATOR = '~';
export const KNOCKED_DOWN_MARKS: ReadonlySet<string> = new Set(['1', '3']);
export const OTHER_MARKS: ReadonlySet<string> = new Set(['2', '3']);

export const LOG_FILE_EXTENSION = '.log';
export const LOG_FILE_HEADER_MARK = '#';
export const INSTANCE = Object.freeze({ local: 'local', server: 'server', sadburst: 'sadburst', testerPrefix: 'tester-' });
export const RUN_QUERY = Object.freeze({ run: 'run', lines: 'lines', kind: 'kind' });
export const RUN_NAME = /^[A-Za-z0-9_-]{1,120}$/;
export const RUN_INSTANCE = /^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_(.+?)(?:-\d+)?$/;
export const UNSAFE_INSTANCE_CHARACTER = /[^A-Za-z0-9_-]/g;
export const SAFE_REPLACEMENT = '_';
export const LINE_BREAKS = /[\r\n]+/g;
export const LINE_BREAK = '\n';
export const LINE_BREAK_REPLACEMENT = ' ';
export const EXISTS_ERROR_CODE = 'EEXIST';
export const EXCLUSIVE_CREATE_FLAG = 'wx';
export const READ_FLAG = 'r';
export const TEXT_ENCODING = 'utf8';
export const DATE_LOCALE = 'en-US';

export const COMMAND = Object.freeze({
  name: 'netlog',
  aliases: ['net', 'packets'],
  show: 'show',
  showAliases: ['tail', 'log', 'filter'],
  runs: 'runs',
  runsAliases: ['list', 'instances', 'files'],
  all: 'all',
  allAliases: ['everything'],
  on: 'on',
  off: 'off',
});
export const FILTER_OPTION = Object.freeze({ in: 'in', out: 'out' });
export const KIND_OPTIONS: Readonly<Record<string, string>> = Object.freeze({
  loss: LINE_KIND.loss, stat: LINE_KIND.stat, stats: LINE_KIND.stat, rel: LINE_KIND.rel, state: LINE_KIND.state, conn: LINE_KIND.conn, pkt: LINE_KIND.packet, packet: LINE_KIND.packet,
});
export const FILTER_TERM = Object.freeze({ run: 'run', type: 'type', conn: 'conn', last: 'last' });
export const FILTER_TERM_PATTERN = /^([a-z]+):(.*)$/i;
export const MESSAGE_TYPE_IN_LINE = /#\d+ ([A-Z][A-Z0-9_]*)/g;
export const LOG_LINE = /^(\S+) {2}(\S+(?: \S+)?)\s+(OUT|IN|---)\s+([A-Z]+)\s+(.*)$/;
export const RUN_NUMBER = /^\d+$/;
export const CONNECTION_WORD_SEPARATOR = ' ';
export const ON_WORD = 'on';
export const OFF_WORD = 'off';
export const TYPE_PREFIX_AT_START = new RegExp(`^${TYPE_PREFIX}`);
export const LOSS_ORDER = Object.freeze(['slow', 'stalled', 'dropped', 'gaps', 'late'] as const);
export const SETTING_NAME = Object.freeze({ recording: 'recording', everything: 'everything' });
export type SettingName = typeof SETTING_NAME[keyof typeof SETTING_NAME];
export const HIDDEN_FILE_PREFIX = '.';
export const LOGGED_MESSAGE = /^(.* REL +#\d+ )([A-Z][A-Z0-9_]*)\((.*)\)$/;
export const ANSWER_SUFFIX = '  <- answers #';
export const ARGUMENT_QUOTE = '"';
export const ARGUMENT_ESCAPE = '\\';
export const ARGUMENT_SEPARATOR = ', ';
export const OPENING_BRACKETS = '[{';
export const CLOSING_BRACKETS = ']}';
