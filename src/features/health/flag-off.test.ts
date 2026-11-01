import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('with health off there is no heal, hp or revive and the HP keys are not applied, while tp, pos and the movement keys still work', async () => {
  const { states } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'health', on: false }], mode: 'local', client: 'official' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  for (const command of ['heal', 'hp 500', 'revive']) assert.match(game.run(command)[0] ?? '', /unknown command/, command);
  game.G.stage.currentFrameLabel = 'gaming';
  game.frame();
  const before: unknown = game.player.hmax;
  game.run('max_hp 777');
  game.frame();
  assert.equal(game.player.hmax, before, 'max_hp is not applied');
  assert.match(game.run('pos')[0] ?? '', /^you: /);
  assert.ok(game.run('speed 2').some((line) => /speed = 2/.test(line)), 'movement keys are their own feature');
  const help = game.run('help');
  const keysLine = help[help.findIndex((line) => line.startsWith('Keys')) + 1] ?? '';
  assert.doesNotMatch(keysLine, /\bgod\b|max_hp/);
  assert.equal(help.some((line) => line.startsWith('Examples: god')), false);
});
