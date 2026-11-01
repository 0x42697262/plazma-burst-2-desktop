import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '../../../test/fake-game.mjs';

test('with the triggers flag off there are no trigger, region, variable or logic commands', async () => {
  const { states } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'triggers', on: false }], mode: 'local', client: 'official' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  for (const command of ['triggers', 'regions', 'vars', 'logic']) {
    assert.match(game.run(command)[0] ?? '', new RegExp(`unknown command "${command}"`));
  }
});
