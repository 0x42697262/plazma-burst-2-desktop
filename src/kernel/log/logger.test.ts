import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogger, eventText } from './logger.ts';

function capture() {
  const lines: unknown[][] = [];
  const output = {
    error: (...parts: unknown[]) => lines.push(['error', ...parts]),
    warn: (...parts: unknown[]) => lines.push(['warn', ...parts]),
    log: (...parts: unknown[]) => lines.push(['log', ...parts]),
  };
  return { lines, output };
}

const fixedNow = () => new Date(2026, 10, 2, 3, 4, 5, 6);

test('a logger prints its level and the ones above; debug lines carry the time', () => {
  const { lines, output } = capture();
  const warn = createLogger('warn', output);
  warn.error('e'); warn.warn('w'); warn.info('i'); warn.debug('d');
  assert.deepEqual(lines, [['error', 'e'], ['warn', 'w']]);
  assert.ok(warn.on('error') && !warn.on('info'));
  lines.length = 0;
  createLogger('debug', output, 'text', fixedNow).debug('d');
  assert.deepEqual(lines, [['log', '03:04:05.006', 'd']]);
});

test('an event is its name and its fields; in json format one object per line', () => {
  assert.equal(eventText('flags.resolved', { hooks: 'off', count: 2 }), 'flags.resolved hooks=off count=2');
  const { lines, output } = capture();
  createLogger('info', output).event('info', 'flags.resolved', { hooks: 'off' });
  assert.deepEqual(lines, [['log', 'flags.resolved hooks=off']]);
  lines.length = 0;
  const json = createLogger('info', output, 'json', fixedNow);
  json.event('warn', 'config.invalid', { problem: 'x' });
  json.info('plain', 1);
  json.debug('hidden');
  assert.deepEqual(lines.map((line) => [line[0], JSON.parse(String(line[1]))]), [
    ['warn', { time: fixedNow().toISOString(), level: 'warn', event: 'config.invalid', problem: 'x' }],
    ['log', { time: fixedNow().toISOString(), level: 'info', event: '', message: 'plain 1' }],
  ]);
});
