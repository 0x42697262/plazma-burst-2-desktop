import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '../../../test/fake-game.mjs';

test('with server_list off (or in Sad Burst 2), the console has no servers command and does not join', async () => {
  const offByFlag = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'server_list', on: false }], mode: 'local', client: 'official' });
  assert.deepEqual(offByFlag.problems, []);
  assert.equal(resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [], mode: 'local', client: 'sadburst' }).states.server_list.on, false);
  assert.equal(resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [], mode: 'server', client: 'official' }).states.server_list.on, false);
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(offByFlag.states) });
  Object.defineProperty(globalThis, 'PB2_JOIN', { value: Object.freeze({ address: '1.2.3.4:2053', nickname: 'Pal', password: 'pw' }) });
  const game = await bootConsole();
  assert.match(game.run('servers')[0] ?? '', /unknown command "servers"/);
  assert.ok(!game.log.printed.some((line) => /Multiplayer connects there/.test(line)));
});
