import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveEdition, withRequirements } from './resolve.ts';

test('"all" is every feature of the catalog, in catalog order', () => {
  const { features, missing, problems } = resolveEdition(CATALOG, 'all');
  assert.deepEqual(features, CATALOG.map((definition) => definition.id));
  assert.deepEqual([missing, problems], [[], []]);
});

test('nothing is added on its own: a requirement left out is a problem that names what to add', () => {
  const { missing, problems } = resolveEdition(CATALOG, ['server_list', 'client_sadburst']);
  assert.deepEqual(missing, ['lobby_task_guard', 'cert_pinning']);
  assert.deepEqual(problems, [
    'server_list needs lobby_task_guard: add "lobby_task_guard" to the edition',
    'server_list needs cert_pinning: add "cert_pinning" to the edition',
  ]);
  const complete = resolveEdition(CATALOG, ['server_list', 'lobby_task_guard', 'cert_pinning', 'client_sadburst']);
  assert.deepEqual(complete.problems, []);
  assert.deepEqual(complete.features, ['lobby_task_guard', 'server_list', 'cert_pinning', 'client_sadburst']);
});

test('a console capability needs the console and its core listed, and a capability its sibling', () => {
  assert.deepEqual(resolveEdition(CATALOG, ['health.god']).missing, ['dev_console']);
  assert.deepEqual(resolveEdition(CATALOG, ['health.god', 'dev_console']).missing, ['console_core']);
  const god = resolveEdition(CATALOG, ['health.god', 'dev_console', 'console_core']);
  assert.deepEqual([god.problems, god.capabilities], [[], ['health.god']]);
  assert.deepEqual(resolveEdition(CATALOG, ['dev_console', 'console_core', 'profiles.bind']).problems, ['profiles.bind needs binds.bind: add "binds.bind" to the edition']);
  assert.deepEqual(withRequirements(CATALOG, ['map_editor']).sort(), ['console_core', 'dev_console', 'map_cache', 'map_editor', 'triggers']);
});

test('an unknown id is a problem, and a feature id means all of its capabilities', () => {
  assert.deepEqual(resolveEdition(CATALOG, ['teleporter']).problems, ['no feature "teleporter" (see "npm start -- --features")']);
  assert.deepEqual(resolveEdition(CATALOG, ['health', 'dev_console', 'console_core']).capabilities, ['health.god', 'health.hp', 'health.heal', 'health.revive']);
});
