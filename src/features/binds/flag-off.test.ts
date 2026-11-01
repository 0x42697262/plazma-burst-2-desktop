import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '../../../test/fake-game.mjs';

test('with the binds flag off there are no bind commands, and a saved bind does not run', async () => {
  const { states } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'binds', on: false }], mode: 'local', client: 'official' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  assert.match(game.run('bind f heal')[0] ?? '', /unknown command "bind"/);
  assert.match(game.run('keyname')[0] ?? '', /unknown command "keyname"/);
  const { binds } = await import('../../../desktop/dev/console/state/store.js') as { binds: { set(key: string, command: string): void } };
  binds.set('f', 'god on');
  game.G.stage.currentFrameLabel = 'gaming';
  game.frame();
  game.press('KeyF');
  assert.equal(game.run('get god')[0], 'god = default');
});
