import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('health capabilities stand alone: with heal and hp off, god and revive stay, and the max HP keys are gone', async () => {
  const { states, capabilities } = resolveFlags({
    catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], mode: 'local', client: 'official',
    envToggles: [{ id: 'health.heal', on: false }, { id: 'health.hp', on: false }],
  });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  Object.defineProperty(globalThis, 'PB2_CAPABILITIES', { value: Object.freeze(capabilities) });
  const game = await bootConsole();
  assert.match(game.run('heal')[0] ?? '', /unknown command "heal"/);
  assert.match(game.run('hp 500')[0] ?? '', /unknown command "hp"/);
  assert.equal(game.run('max_hp 500').some((line) => /max_hp = 500/.test(line)), false, 'max_hp belongs to health.hp');
  assert.ok(game.run('god on').some((line) => /god = on/.test(line)), 'god is its own capability');
  assert.doesNotMatch(game.run('revive').join(' '), /unknown command/, 'revive is its own capability');
  const help = game.run('help');
  const keysLine = help[help.findIndex((line) => line.startsWith('Keys')) + 1] ?? '';
  assert.match(keysLine, /\bgod\b/);
  assert.doesNotMatch(keysLine, /max_hp|hp_bonus/);
  game.G.stage.currentFrameLabel = 'gaming';
  game.frame();
  const before = game.player.hea;
  game.player.hea = before - 30;
  assert.equal(game.player.hea, before, 'god still blocks damage');
});
