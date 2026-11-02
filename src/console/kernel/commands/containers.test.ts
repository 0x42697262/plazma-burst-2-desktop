import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

test('a command whose own capability is off keeps the subcommands that are on, and says so', async () => {
  const { states, capabilities } = resolveFlags({
    catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], mode: 'local', client: 'official',
    envToggles: [{ id: 'fingerprint.run', on: false }, { id: 'scan_bypass.checks', on: false }],
  });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  Object.defineProperty(globalThis, 'PB2_CAPABILITIES', { value: Object.freeze(capabilities) });
  const game = await bootConsole();
  assert.match(errorsOf(game.run('fingerprint'))[0] ?? '', /this app has only "fingerprint list"/);
  assert.deepEqual(errorsOf(game.run('fingerprint list')), [], 'the list subcommand is still there');
  assert.match(game.run('bypass')[0] ?? '', /^Protection: on/, 'the status is its own capability');
  assert.equal(game.run('help fingerprint')[0], 'fingerprint [list]', 'the usage names only what is there');
  assert.doesNotMatch(game.run('bypass checks').join('\n'), /WARNING: DANGEROUS/, 'checks is gone, so the protection cannot be turned off');
});
