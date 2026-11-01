import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '../../../../test/fake-game.mjs';

const injected = resolveFlags({
  catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'hooks', on: false }], mode: 'local', client: 'official',
}).states;

test('"features" lists every flag as the wrapper resolved it, and a feature that is off registers nothing', async () => {
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(injected) });
  const game = await bootConsole();
  const printed = game.run('features');
  assert.equal(printed[0], 'Feature flags');
  assert.equal(printed.length, CATALOG.length + 2);
  assert.match(printed.find((line) => line.startsWith('hooks ')) ?? '', /^hooks\s+off\s+env\s/);
  assert.deepEqual(game.run('flags'), printed);

  const { allowedHere } = await import('../core/mode.ts');
  assert.equal(allowedHere({ name: 'x', feature: 'hooks' }), false);
  assert.equal(allowedHere({ name: 'x', feature: 'zoom' }), true);
  assert.equal(allowedHere({ name: 'x' }), true);
  assert.equal(allowedHere({ name: 'x', feature: 'remote_play' }), false, 'not in local mode');
});
