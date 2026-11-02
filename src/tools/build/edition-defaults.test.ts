import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { withRequirements } from '#kernel/editions/resolve.ts';
import { checkDefaults } from './edition-defaults.ts';
import { oneOffEdition } from './edition-file.ts';

const FP = Array.from({ length: 32 }, (_, index) => index.toString(16).padStart(2, '0').toUpperCase()).join(':');
const noNetwork = async (): Promise<string> => { throw new Error('no network in tests'); };
const editionOf = (listed: readonly string[]) => oneOffEdition(withRequirements(CATALOG, listed)).edition;

test('binds and settings are checked against the edition and become the first settings file', async () => {
  const edition = editionOf(['teleport', 'binds', 'player_info.chars', 'movement.speed']);
  const { defaults, problems, missing } = await checkDefaults(edition, { binds: { 'Shift+F': 'tp', 'alt+c': 'chars; tp' }, settings: { speed: '2' } }, noNetwork);
  assert.deepEqual(problems, []);
  assert.deepEqual(missing, []);
  assert.deepEqual(defaults.settings, { speed: 2, binds: { 'shift+f': 'tp', 'alt+c': 'chars; tp' } });
});

test('a default the edition cannot use stops the build and names what to add', async () => {
  const edition = editionOf(['teleport']);
  const { problems, missing } = await checkDefaults(edition, {
    servers: [{ address: '18.231.112.9:2053', fingerprint: FP }],
    binds: { 'alt+c': 'chars', 'alt+p': 'pos', 'alt+n': 'nonsense', 'ctrl+': 'tp' },
    settings: { speed: 2, nothing_like_this: 1 },
  }, noNetwork);
  assert.deepEqual([...missing].sort(), ['binds.bind', 'movement.speed', 'player_info.chars', 'player_info.pos', 'server_list']);
  assert.ok(problems.includes('defaults: bind alt+c runs "chars", which needs player_info.chars: add "player_info.chars" to the edition'), problems.join('\n'));
  assert.ok(problems.includes('defaults: bind alt+n runs "nonsense", which is no console command'));
  assert.ok(problems.some((problem) => problem.startsWith('defaults: bind "ctrl+": ')));
  assert.ok(problems.includes('defaults: no setting "nothing_like_this" (see "list" in the console)'));
});

test('servers keep their pinned fingerprint; "fetch" prints what the server shows and stops, so it is compared first', async () => {
  const edition = editionOf(['server_list']);
  const kept = await checkDefaults(edition, { servers: [{ name: 'Pal base', address: '18.231.112.9:2053', fingerprint: FP.toLowerCase() }] }, noNetwork);
  assert.deepEqual(kept.problems, []);
  assert.deepEqual(kept.defaults.servers, [{ name: 'Pal base', address: '18.231.112.9:2053', fingerprint: FP }]);
  const fetched = await checkDefaults(edition, { servers: [{ address: '18.231.112.9', fingerprint: 'fetch' }] }, async (host, port) => `${host}:${port}=${FP}`);
  assert.match(fetched.problems[0] ?? '', /server 1 \(18\.231\.112\.9\) shows the fingerprint 18\.231\.112\.9:2053=00:01.*in place of "fetch"$/);
  assert.deepEqual(fetched.defaults.servers, []);
  const broken = await checkDefaults(edition, { servers: [{ address: 'not an address', fingerprint: 'AB' }] }, noNetwork);
  assert.match(broken.problems[0] ?? '', /^defaults: server 1: address: .*fingerprint: /);
});
