import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConfig, roundDurationMs, parsePorts, parseServerArgs } from './domain/config.ts';
import { pageLine, plainChat } from './domain/page-log.ts';

test('config: the game\'s preset, made player-hosted and unranked, with the host\'s own settings', () => {
  const result = checkConfig({
    _comment: 'ignored',
    match: { title: 'Friends', map_id: 'nanotech-cht', max_players: '16', game_type: 'tdm', password: 'pw', ranked: true, p2p: false, round_duration_str: '1 hour 30 minutes', ping_limit: 150 },
    allow: ['Friend1', ' friend1 ', 'buddy'],
    udp_ports: '50000-50010',
    ice_servers: ['stun:stun.example.com:3478', { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'c' }],
    region: 'Asia',
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.match!.p2p, true);
  assert.equal(result.match!.ranked, false);
  assert.equal(result.match!.accept_connections_manually, false);
  assert.equal(result.match!.game_type, 'TDM');
  assert.equal(result.match!.max_players, 16);
  assert.equal(result.match!.round_duration, 5400000);
  assert.equal(result.match!.ping_limit, '150');
  assert.equal(result.match!.p2p_region, 'Asia');
  assert.deepEqual(result.server!.allow, ['friend1', 'buddy']);
  assert.deepEqual(result.server!.udp_ports, { min: 50000, max: 50010 });
  assert.equal(result.server!.ice_servers.length, 2);
  assert.ok(result.problems.some((problem) => /match\.ranked: always false/.test(problem)));
  assert.ok(result.problems.some((problem) => /match\.p2p: always true/.test(problem)));
});

test('config: what stops the host, and what only warns', () => {
  assert.ok(checkConfig({ match: {} }).errors.some((error) => /map_id/.test(error)));
  const bad = checkConfig({ match: { map_id: 'x', max_players: 7, game_type: 'CTF', ping_limit_action: 'nope' }, udp_ports: '80-90', fps: 1, ice_servers: [{ urls: 'turn:x' }], allow: 'bob' });
  for (const want of [/max_players/, /game_type/, /ping_limit_action/, /udp_ports/, /fps/, /TURN server needs/, /allow:/]) {
    assert.ok(bad.errors.some((error) => want.test(error)), String(want));
  }
  const open = checkConfig({ match: { map_id: 'x', map_rotation: 'random approved' }, local_map: 'mine', nope: 1 });
  assert.deepEqual(open.errors, []);
  assert.ok(open.problems.some((problem) => /anyone who sees the match/.test(problem)));
  assert.ok(open.problems.some((problem) => /map_rotation/.test(problem)));
  assert.ok(open.problems.some((problem) => /nope: unknown/.test(problem)));
  assert.equal(checkConfig({ match: { map_id: 'x' }, local_map: 'local-mine.xml' }).server?.local_map, 'mine');
  assert.ok(checkConfig({ match: { map_id: 'x' }, local_map: '../etc' }).errors.some((error) => /local_map/.test(error)));
});

test('config: round duration like the create screen, ports, arguments', () => {
  assert.equal(roundDurationMs('default'), 0);
  assert.equal(roundDurationMs('10 minutes'), 600000);
  assert.equal(roundDurationMs('1 hour 30 minutes 5 seconds'), 5405000);
  assert.equal(roundDurationMs('soon'), null);
  assert.equal(parsePorts(''), null);
  assert.deepEqual(parsePorts('50000'), { min: 50000, max: 50000 });
  assert.throws(() => parsePorts('9-1'));
  assert.equal(parseServerArgs(['electron', '.', '--p2p-host', '--config', 'my.json']).config, 'my.json');
  assert.equal(parseServerArgs(['--config=x.json']).config, 'x.json');
});

test('the host page\'s console lines: its own lines and chat as plain text, errors as errors, the rest for --verbose', () => {
  assert.deepEqual(pageLine({ message: '[pb2dev] hello', level: 'info' }), { level: 'info', text: 'hello' });
  assert.deepEqual(pageLine({ message: '[chat] <b>Pal</b>: a &lt;3 &amp; b', level: 'info' }), { level: 'info', text: '[chat] Pal: a <3 & b' });
  assert.deepEqual(pageLine({ message: 'boom', level: 'error', sourceId: 'https://x/h5/scripts/frame2.js', lineNumber: 12 }), { level: 'error', text: '[page] boom (frame2.js:12)' });
  assert.deepEqual(pageLine({ message: 'note', level: 'warning' }), { level: 'debug', text: '[page:warning] note' });
  assert.equal(plainChat('&nbsp;&quot;&#39;'), ' "\'');
});
