import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('with teleport off there is no tp, and the other player commands are still there', async () => {
  const { states } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'teleport', on: false }], mode: 'local', client: 'official' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  assert.match(game.run('tp')[0] ?? '', /unknown command "tp"/);
  assert.match(game.run('teleport 1')[0] ?? '', /unknown command "teleport"/, 'nor its alias');
  assert.match(game.run('pos')[0] ?? '', /^you: /);
});
