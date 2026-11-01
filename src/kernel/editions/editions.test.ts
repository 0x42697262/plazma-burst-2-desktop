import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveEdition } from './resolve.ts';

test('"all" is every feature of the catalog, in catalog order', () => {
  const { features, added, problems } = resolveEdition(CATALOG, 'all');
  assert.deepEqual(features, CATALOG.map((definition) => definition.id));
  assert.deepEqual([added, problems], [[], []]);
});

test('a player edition: private servers bring their guard and certificate pinning, and nothing else', () => {
  const { features, added, problems } = resolveEdition(CATALOG, ['server_list', 'client_sadburst', 'login']);
  assert.deepEqual(problems, []);
  assert.deepEqual(features, ['lobby_task_guard', 'server_list', 'login', 'cert_pinning', 'client_sadburst']);
  assert.deepEqual(added, ['lobby_task_guard: always comes with server_list', 'cert_pinning: always comes with server_list']);
});

test('a console feature brings the console, the console core and what it needs', () => {
  const { features, added } = resolveEdition(CATALOG, ['map_editor']);
  assert.deepEqual(features, ['dev_console', 'console_core', 'triggers', 'map_cache', 'map_editor']);
  assert.ok(added.includes('console_core: always on where dev_console is'), added.join('\n'));
});

test('an unknown feature is a problem, so the build stops', () => {
  assert.deepEqual(resolveEdition(CATALOG, ['server_list', 'teleporter']).problems, ['no feature "teleporter" (see "npm start -- --features")']);
});
