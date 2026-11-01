import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENTS, clientFor, wantsSadburst, withoutClientFlag } from './clients.ts';

test('every command is for the official client unless --sadburst is asked for', () => {
  assert.equal(clientFor(['node', 'x'], {}).id, 'official');
  assert.equal(clientFor(['node', 'x', '--sadburst'], {}).id, 'sadburst');
  assert.equal(wantsSadburst([], { npm_config_sadburst: 'true' }), true);
  assert.equal(wantsSadburst([], { npm_config_sadburst: '' }), true);
  assert.equal(wantsSadburst([], { npm_config_sadburst: 'false' }), false);
  assert.equal(wantsSadburst([], { npm_config_sadburst: '0' }), false);
  assert.deepEqual(withoutClientFlag(['--sadburst', 'v1', '--out', 'x']), ['v1', '--out', 'x']);
});

test('each client keeps its own files, settings, session and page', () => {
  const { official, sadburst } = CLIENTS;
  assert.notEqual(sadburst.gameDir, official.gameDir);
  assert.notEqual(sadburst.names, official.names);
  assert.notEqual(sadburst.opcodes, official.opcodes);
  assert.notEqual(sadburst.settingsFileName, official.settingsFileName);
  assert.equal(official.partition, null, 'the official client uses the default session');
  assert.equal(sadburst.partition, 'persist:sadburst');
  assert.equal(official.gamePrefix('v123'), '/h5/versions/v123/');
  assert.equal(sadburst.gamePrefix('v123'), '/gameplay/');
  assert.equal(official.runFlag, '');
  assert.equal(sadburst.runFlag, ' -- --sadburst');
});

test('switching clients changes only the client flag, so the app starts again as the other one', async () => {
  const { argsForClient } = await import('./clients.ts');
  assert.deepEqual(argsForClient(['.', '--verbose'], 'sadburst'), ['.', '--verbose', '--sadburst']);
  assert.deepEqual(argsForClient(['.', '--sadburst', '--verbose'], 'official'), ['.', '--verbose']);
});
