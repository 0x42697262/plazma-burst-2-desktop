import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('with guns off, the gun and bullet keys are not offered, not set and not applied, and a saved value is kept for later', async () => {
  const { states } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'guns', on: false }], mode: 'local', client: 'official' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  const saved = { bullet_damage: 5 };
  (Reflect.get(globalThis, 'pb2dev') as { reload(saved: unknown): void }).reload(saved);
  const help = game.run('help').join('\n');
  assert.doesNotMatch(help, /bullet_damage|fire_rate|Guns:/);
  assert.match(help, /god, max_hp/, 'the player keys stay');
  assert.match(game.run('set bullet_damage 9')[0] ?? '', /bullet_damage/);
  assert.equal(game.run('get bullet_damage').some((line) => /= 9/.test(line)), false, 'not set');
  assert.equal(game.run('list').some((line) => /bullet_damage/.test(line)), false, 'not listed');
  const consoleApi = Reflect.get(globalThis, 'pb2dev') as { kv: Record<string, unknown> };
  assert.equal(consoleApi.kv.bullet_damage, 5, 'the saved value stays in the file');
});
