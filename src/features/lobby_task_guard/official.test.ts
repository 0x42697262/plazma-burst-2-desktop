import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '../../../test/fake-game.mjs';

test('on the official server the guard changes nothing: the connection class is left as it is', async () => {
  const receiveName = '__pb2_connRecv';
  class Connection { [receiveName](_text: string) { return undefined; } }
  const original = Connection.prototype[receiveName];
  Reflect.set(globalThis, '__pb2_connClass', Connection);
  await bootConsole();
  assert.equal(Connection.prototype[receiveName], original);
});

test('with lobby_task_guard off, a private lobby can run code again (the old behavior)', async () => {
  const { CATALOG } = await import('#shared/features/catalog.ts');
  const { resolveFlags } = await import('#kernel/flags/resolve.ts');
  const { states, problems } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id: 'lobby_task_guard', on: false }], mode: 'local', client: 'official' });
  assert.deepEqual(problems, []);
  assert.equal(states.lobby_task_guard.on, false);
});
