import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

test('triggers capabilities stand alone: find without the list, regions without regions run, no logic at all', async () => {
  const off = ['triggers.list', 'triggers.run', 'triggers.history', 'triggers.exec', 'triggers.actions', 'triggers.regions_run', 'triggers.logic', 'triggers.logic_show', 'triggers.logic_tree'];
  const { states, capabilities } = resolveFlags({
    catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], mode: 'local', client: 'official',
    envToggles: off.map((id) => ({ id, on: false })),
  });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  Object.defineProperty(globalThis, 'PB2_CAPABILITIES', { value: Object.freeze(capabilities) });
  const game = await bootConsole();
  assert.match(errorsOf(game.run('triggers'))[0] ?? '', /this app has only "triggers find"/);
  assert.deepEqual(errorsOf(game.run('triggers find door')), []);
  assert.deepEqual(errorsOf(game.run('regions')), [], 'the regions list is its own capability');
  assert.match(errorsOf(game.run('logic show'))[0] ?? '', /unknown command "logic"/);
  assert.equal(game.run('get trigger_history').some((line) => /trigger_history =/.test(line)), false, 'its key belongs to triggers.history');
});
