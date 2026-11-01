import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('with the netlog flag off, the console has no netlog command and records nothing', async () => {
  const { states, problems } = resolveFlags({
    catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'netlog', on: false }], mode: 'local', client: 'official',
  });
  assert.deepEqual(problems, []);
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  assert.match((game.run('netlog'))[0] ?? '', /unknown command|not a command|Unknown/i);
  assert.ok(!(game.run('help')).some((line) => /^ {2}netlog\b/.test(line)));
  const intervals = game.intervals as (() => void)[];
  for (const interval of intervals) interval();
  assert.equal((game.log.net).length, 0);
});
