// desktop/clients.js: which client a command is for. "npm test".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { clientFor, wantsSadburst, withoutClientFlag, CLIENTS } = createRequire(import.meta.url)('../desktop/clients.js');

test('every command is for the official client unless --sadburst is asked for', () => {
  assert.equal(clientFor(['node', 'x'], {}).id, 'official');
  assert.equal(clientFor(['node', 'x', '--sadburst'], {}).id, 'sadburst');
  // "npm run x --sadburst" on npm versions that pass it as a config value.
  assert.equal(wantsSadburst([], { npm_config_sadburst: 'true' }), true);
  assert.equal(wantsSadburst([], { npm_config_sadburst: '' }), true);
  assert.equal(wantsSadburst([], { npm_config_sadburst: 'false' }), false);
  assert.deepEqual(withoutClientFlag(['--sadburst', 'v1', '--out', 'x']), ['v1', '--out', 'x']);
  assert.notEqual(CLIENTS.sadburst.gameDir, CLIENTS.official.gameDir);
  assert.notEqual(CLIENTS.sadburst.names, CLIENTS.official.names);
});
