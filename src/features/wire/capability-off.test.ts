import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

test('with wire.match off, lobby messages still send but match messages are refused', async () => {
  const { states, capabilities, problems } = resolveFlags({
    catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'wire.match', on: false }], mode: 'local', client: 'official',
  });
  assert.deepEqual(problems, []);
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  Object.defineProperty(globalThis, 'PB2_CAPABILITIES', { value: Object.freeze(capabilities) });
  const game = await bootConsole();
  assert.match(errorsOf(game.run('wire hit_player'))[0] ?? '', /turned off/);
  assert.ok(game.run('wire join_match 52099 --dry').some((line) => /would send/.test(String(line))), 'a lobby message still works');
  assert.equal(game.run('wire list').length, 44, 'wire list still answers');
});
