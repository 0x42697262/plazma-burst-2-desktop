// desktop/log.js: the wrapper's terminal log levels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { parseLogLevel, createLogger } = createRequire(import.meta.url)('../desktop/log.js');

test('log level from the command line or PB2_LOG_LEVEL; --verbose is debug', () => {
  assert.deepEqual(parseLogLevel(['electron', '.'], {}), { level: 'info', problem: null });
  assert.equal(parseLogLevel(['electron', '.', '--verbose'], {}).level, 'debug');
  assert.equal(parseLogLevel(['-v'], {}).level, 'debug');
  assert.equal(parseLogLevel(['--log-level=WARN'], {}).level, 'warn');
  assert.equal(parseLogLevel(['--log-level', 'error'], {}).level, 'error');
  assert.equal(parseLogLevel([], { PB2_LOG_LEVEL: 'debug' }).level, 'debug');
  assert.equal(parseLogLevel(['--log-level=warn'], { PB2_LOG_LEVEL: 'debug' }).level, 'warn', 'the command line wins');
  const bad = parseLogLevel(['--log-level=loud'], {});
  assert.equal(bad.level, 'info');
  assert.match(bad.problem, /unknown log level "loud" \(error, warn, info, debug\)/);
});

test('a logger prints its level and the ones above; debug lines carry the time', () => {
  const lines = [];
  const out = { error: (...a) => lines.push(['error', ...a]), warn: (...a) => lines.push(['warn', ...a]), log: (...a) => lines.push(['log', ...a]) };
  const warn = createLogger('warn', out);
  warn.error('e'); warn.warn('w'); warn.info('i'); warn.debug('d');
  assert.deepEqual(lines, [['error', 'e'], ['warn', 'w']]);
  assert.ok(warn.on('error') && !warn.on('info'));
  lines.length = 0;
  createLogger('debug', out).debug('d');
  assert.equal(lines[0][0], 'log');
  assert.match(lines[0][1], /^\d\d:\d\d:\d\d\.\d{3}$/);
  assert.equal(lines[0][2], 'd');
});
