import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '../../../test/fake-game.mjs';

test('with the player flag off there are no player commands and the player settings are not applied', async () => {
  const { states } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'player', on: false }], mode: 'local', client: 'official' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  assert.match(game.run('heal')[0] ?? '', /unknown command "heal"/);
  assert.match(game.run('tp')[0] ?? '', /unknown command "tp"/);
  game.G.stage.currentFrameLabel = 'gaming';
  game.frame();
  const before: unknown = game.player.hmax;
  game.run('max_hp 777');
  game.frame();
  assert.equal(game.player.hmax, before);
});
