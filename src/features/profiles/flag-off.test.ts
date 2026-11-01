import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '../../../test/fake-game.mjs';

test('with the profiles flag off, there is no profile command and no map\'s profile applies', async () => {
  const { states } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'profiles', on: false }], mode: 'local', client: 'official' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(states) });
  const game = await bootConsole();
  assert.match(game.run('profile')[0] ?? '', /unknown command "profile"/);
  const { profiles, activeProfile } = await import('../../../desktop/dev/console/state/store.js') as { profiles: { set(name: string, key: string, value: unknown): void; use(map: string, name: string): void }; activeProfile(): unknown };
  game.G[game.N.mapId] = 'c1a';
  profiles.set('hard', 'god', false);
  profiles.use('c1a', 'hard');
  assert.equal(activeProfile(), null);
});
