// The wrapper's terminal log, by level: error < warn < info < debug. "info" is the
// default; --verbose (or -v) is "debug", which adds every request the wrapper serves or
// passes on, the window's load and crash events, and the game's own trace() output.
//   npm start -- --verbose
//   npm start -- --log-level=warn
//   PB2_LOG_LEVEL=debug npm start
'use strict';

const LEVELS = Object.freeze(['error', 'warn', 'info', 'debug']);
const DEFAULT_LEVEL = 'info';

// The level asked for on the command line or in PB2_LOG_LEVEL (the command line wins).
// Returns { level, problem }: problem names a level that does not exist.
function parseLogLevel(argv = process.argv, env = process.env) {
  let asked = env.PB2_LOG_LEVEL || null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--verbose' || a === '-v') asked = 'debug';
    else if (a.startsWith('--log-level=')) asked = a.slice('--log-level='.length);
    else if (a === '--log-level' && argv[i + 1]) asked = argv[++i];
  }
  if (!asked) return { level: DEFAULT_LEVEL, problem: null };
  const level = String(asked).toLowerCase();
  if (LEVELS.includes(level)) return { level, problem: null };
  return { level: DEFAULT_LEVEL, problem: `unknown log level "${asked}" (${LEVELS.join(', ')}); using ${DEFAULT_LEVEL}` };
}

const two = (n, w = 2) => String(n).padStart(w, '0');
const clock = (d = new Date()) => `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${two(d.getMilliseconds(), 3)}`;

// log.error/warn/info/debug(...args) print when the level allows it; at debug every line
// starts with the time. log.on(level) says whether a level prints.
function createLogger(level = DEFAULT_LEVEL, out = console) {
  const rank = LEVELS.indexOf(level);
  const on = (l) => LEVELS.indexOf(l) <= rank;
  const stamp = level === 'debug';
  const write = { error: out.error, warn: out.warn, info: out.log, debug: out.log };
  const log = { level, on };
  for (const l of LEVELS) {
    log[l] = (...args) => { if (on(l)) write[l].call(out, ...(stamp ? [clock()] : []), ...args); };
  }
  return log;
}

module.exports = { LEVELS, DEFAULT_LEVEL, parseLogLevel, createLogger };
