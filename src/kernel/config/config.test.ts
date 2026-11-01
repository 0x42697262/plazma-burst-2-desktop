import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLogLevel } from './log-level.ts';
import { parseEnvironment } from './environment.ts';

test('log level from the command line or PB2_LOG_LEVEL; --verbose is debug', () => {
  assert.deepEqual(parseLogLevel(['electron', '.'], {}), { level: 'info', problem: null });
  assert.equal(parseLogLevel(['electron', '.', '--verbose'], {}).level, 'debug');
  assert.equal(parseLogLevel(['-v'], {}).level, 'debug');
  assert.equal(parseLogLevel(['--log-level=WARN'], {}).level, 'warn');
  assert.equal(parseLogLevel(['--log-level', 'error'], {}).level, 'error');
  assert.equal(parseLogLevel([], { PB2_LOG_LEVEL: 'debug' }).level, 'debug');
  assert.equal(parseLogLevel(['--log-level=warn'], { PB2_LOG_LEVEL: 'debug' }).level, 'warn', 'the command line wins');
  const bad = parseLogLevel(['--log-level=loud'], {});
  assert.equal(bad.level, 'info');
  assert.match(bad.problem ?? '', /unknown log level "loud" \(error, warn, info, debug\)/);
});

test('with nothing set: the official client, local mode, no overrides', () => {
  const { environment, problems } = parseEnvironment(['electron', '.'], {});
  assert.deepEqual(problems, []);
  assert.deepEqual({ ...environment, args: [] }, {
    client: 'official', mode: 'local', gameDir: null, gameVersion: null, logLevel: 'info', logFormat: 'text',
    featureToggles: [], credentials: {}, listFeatures: false, args: [],
  });
});

test('the client: --sadburst, or npm_config_sadburst unless it is "false" or "0"', () => {
  assert.equal(parseEnvironment(['.', '--sadburst'], {}).environment.client, 'sadburst');
  assert.equal(parseEnvironment(['.'], { npm_config_sadburst: '' }).environment.client, 'sadburst');
  assert.equal(parseEnvironment(['.'], { npm_config_sadburst: 'true' }).environment.client, 'sadburst');
  assert.equal(parseEnvironment(['.'], { npm_config_sadburst: 'false' }).environment.client, 'official');
  assert.equal(parseEnvironment(['.'], { npm_config_sadburst: '0' }).environment.client, 'official');
});

test('the mode: --host is remote play, --p2p-host the dedicated host, --host wins', () => {
  assert.equal(parseEnvironment(['.', '--host'], {}).environment.mode, 'remote');
  assert.equal(parseEnvironment(['.', '--p2p-host'], {}).environment.mode, 'server');
  assert.equal(parseEnvironment(['.', '--p2p-host', '--host'], {}).environment.mode, 'remote');
});

test('feature toggles: PB2_DEV=0 and PB2_HOOKS=0 come first, then PB2_FEATURES in order', () => {
  const { environment, problems } = parseEnvironment(['.'], { PB2_DEV: '0', PB2_HOOKS: '0', PB2_FEATURES: '+dev_console,-zoom' });
  assert.deepEqual(problems, []);
  assert.deepEqual(environment.featureToggles, [
    { id: 'dev_console', on: false }, { id: 'hooks', on: false }, { id: 'dev_console', on: true }, { id: 'zoom', on: false },
  ]);
  assert.deepEqual(parseEnvironment(['.'], { PB2_DEV: '1', PB2_HOOKS: 'yes' }).environment.featureToggles, []);
});

test('invalid values are problems: a bad feature list, an unknown log level or format', () => {
  const { problems } = parseEnvironment(['.', '--log-level=loud', '--log-format=xml'], { PB2_FEATURES: 'hooks' });
  assert.equal(problems.length, 3);
  assert.match(problems[0] ?? '', /unknown log level "loud"/);
  assert.match(problems[1] ?? '', /unknown log format "xml"/);
  assert.match(problems[2] ?? '', /PB2_FEATURES="hooks": expected \+id or -id/);
});

test('game folder, version, log format, credentials and --features are read; empty values count as unset', () => {
  const { environment } = parseEnvironment(['.', '--features', '--log-format=json'], {
    PB2_GAME_DIR: '/games/pb2', PB2_VERSION: '', PB2_LOGIN: 'me', PB2_PASSWORD: 'secret', PB2_UID: '',
  });
  assert.equal(environment.gameDir, '/games/pb2');
  assert.equal(environment.gameVersion, null);
  assert.equal(environment.logFormat, 'json');
  assert.deepEqual(environment.credentials, { login: 'me', password: 'secret' });
  assert.equal(environment.listFeatures, true);
});
