import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { clientOfVersion } from '#shared/clients/keys.ts';
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

test('--sadburst-erich5 is its own client, and does not count as --sadburst', () => {
  assert.equal(clientFor(['node', 'x', '--sadburst-erich5'], {}).id, 'sadburst_erich5');
  assert.equal(clientFor([], { npm_config_sadburst_erich5: 'true' }).id, 'sadburst_erich5');
  assert.equal(clientFor([], { npm_config_sadburst_erich5: 'false' }).id, 'official');
  assert.equal(wantsSadburst(['--sadburst-erich5'], {}), false);
  assert.deepEqual(withoutClientFlag(['--sadburst-erich5', 'v1', '--sadburst']), ['v1']);
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

test('Sad Burst 2 for the official servers keeps its own files, settings, session and page', () => {
  const { sadburst, sadburst_erich5: erich5 } = CLIENTS;
  for (const field of ['gameDir', 'names', 'opcodes', 'settingsFileName', 'partition'] as const) assert.notEqual(erich5[field], sadburst[field], field);
  assert.equal(erich5.partition, 'persist:sadburst-erich5');
  assert.equal(erich5.gamePrefix('v123'), '/gameplay_erich5/');
  assert.equal(erich5.host, sadburst.host);
  assert.equal(erich5.runFlag, ' -- --sadburst-erich5');
  assert.equal(erich5.feature, 'client_sadburst_erich5');
  assert.equal(erich5.bundled, true);
  assert.equal(path.basename(erich5.names), erich5.namesFileName);
});

test('a game version tells the page which client it is', () => {
  assert.equal(clientOfVersion('v1769098419'), 'official');
  assert.equal(clientOfVersion('sadburst-20261030020533'), 'sadburst');
  assert.equal(clientOfVersion('erich5-20261108195354'), 'sadburst_erich5');
  assert.equal(clientOfVersion(undefined), 'official');
});

test('which clients play the official servers with the official accounts', async () => {
  const { usesOfficialServers } = await import('#shared/clients/keys.ts');
  assert.equal(usesOfficialServers('official'), true);
  assert.equal(usesOfficialServers('sadburst_erich5'), true);
  assert.equal(usesOfficialServers('sadburst'), false);
  assert.equal(usesOfficialServers(null), false);
  assert.equal(usesOfficialServers('nope'), false);
});
