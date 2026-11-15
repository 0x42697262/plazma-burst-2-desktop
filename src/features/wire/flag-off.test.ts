import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

test('with the wire flag off, there is no wire command', async () => {
  const { states, problems } = resolveFlags({
    catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'wire', on: false }], mode: 'local', client: 'official',
  });
  assert.deepEqual(problems, []);
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  assert.match(errorsOf(game.run('wire hit_player'))[0] ?? '', /unknown command|not a command/i);
  assert.ok(!(game.run('help')).some((line) => /^ {2}wire\b/.test(String(line))));
});
