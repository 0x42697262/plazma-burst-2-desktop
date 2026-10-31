// The dedicated host ("npm run server"): its config file, and its driver in the page
// (desktop/dev/console/server/host.js) against the fake game.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { checkConfig, roundDurationMs, parsePorts, parseServerArgs } = require('../desktop/server/config.js');

test('config: the game\'s preset, made player-hosted and unranked, with the host\'s own settings', () => {
  const r = checkConfig({
    _comment: 'ignored',
    match: { title: 'Friends', map_id: 'nanotech-cht', max_players: '16', game_type: 'tdm', password: 'pw', ranked: true, p2p: false, round_duration_str: '1 hour 30 minutes', ping_limit: 150 },
    allow: ['Friend1', ' friend1 ', 'buddy'],
    udp_ports: '50000-50010',
    ice_servers: ['stun:stun.example.com:3478', { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'c' }],
    region: 'Asia',
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.match.p2p, true);
  assert.equal(r.match.ranked, false);
  assert.equal(r.match.accept_connections_manually, false);
  assert.equal(r.match.game_type, 'TDM');
  assert.equal(r.match.max_players, 16);
  assert.equal(r.match.round_duration, 5400000);
  assert.equal(r.match.ping_limit, '150');
  assert.equal(r.match.p2p_region, 'Asia');
  assert.deepEqual(r.server.allow, ['friend1', 'buddy']);
  assert.deepEqual(r.server.udp_ports, { min: 50000, max: 50010 });
  assert.equal(r.server.ice_servers.length, 2);
  assert.ok(r.problems.some((p) => /match\.ranked: always false/.test(p)));
  assert.ok(r.problems.some((p) => /match\.p2p: always true/.test(p)));
});

test('config: what stops the host, and what only warns', () => {
  assert.ok(checkConfig({ match: {} }).errors.some((e) => /map_id/.test(e)));
  const bad = checkConfig({ match: { map_id: 'x', max_players: 7, game_type: 'CTF', ping_limit_action: 'nope' }, udp_ports: '80-90', fps: 1, ice_servers: [{ urls: 'turn:x' }], allow: 'bob' });
  for (const want of [/max_players/, /game_type/, /ping_limit_action/, /udp_ports/, /fps/, /TURN server needs/, /allow:/]) {
    assert.ok(bad.errors.some((e) => want.test(e)), String(want));
  }
  const open = checkConfig({ match: { map_id: 'x', map_rotation: 'random approved' }, local_map: 'mine', nope: 1 });
  assert.deepEqual(open.errors, []);
  assert.ok(open.problems.some((p) => /anyone who sees the match/.test(p)));
  assert.ok(open.problems.some((p) => /map_rotation/.test(p)));
  assert.ok(open.problems.some((p) => /nope: unknown/.test(p)));
  assert.equal(checkConfig({ match: { map_id: 'x' }, local_map: 'local-mine.xml' }).server.local_map, 'mine');
  assert.ok(checkConfig({ match: { map_id: 'x' }, local_map: '../etc' }).errors.some((e) => /local_map/.test(e)));
});

test('config: round duration like the create screen, ports, arguments', () => {
  assert.equal(roundDurationMs('default'), 0);
  assert.equal(roundDurationMs('10 minutes'), 600000);
  assert.equal(roundDurationMs('1 hour 30 minutes 5 seconds'), 5405000);
  assert.equal(roundDurationMs('soon'), null);
  assert.equal(parsePorts(''), null);
  assert.deepEqual(parsePorts('50000'), { min: 50000, max: 50000 });
  assert.throws(() => parsePorts('9-1'));
  assert.equal(parseServerArgs(['electron', '.', '--server', '--config', 'my.json']).config, 'my.json');
  assert.equal(parseServerArgs(['--config=x.json']).config, 'x.json');
});

// Server mode is decided when the console's modules load, so these run in their own process.
const at = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const childOut = (src) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', src], { cwd: REPO, encoding: 'utf8' }));

test('not on the dedicated host: no "server", "who", "kick" or "say"', () => {
  const out = childOut(`
    const { bootConsole } = await import(${JSON.stringify(at('test/fake-game.mjs'))});
    await bootConsole();
    const { findRunnable } = await import(${JSON.stringify(at('desktop/dev/console/commands/registry.js'))});
    process.stdout.write(JSON.stringify(['server', 'who', 'kick', 'say'].map((w) => !!findRunnable(w))));
  `);
  assert.deepEqual(out, [false, false, false, false]);
});

const HOST_CHILD = `
  const { createRequire } = await import('node:module');
  const require = createRequire(${JSON.stringify(at('test/server.test.mjs'))});
  const { checkConfig } = require('../desktop/server/config.js');
  const cfg = checkConfig({ match: { map_id: 'nanotech-cht', password: 'pw' }, allow: ['friend'], region: 'Asia', restart_after_s: 5 });
  Object.defineProperty(globalThis, 'PB2_SERVER', { value: { match: cfg.match, server: cfg.server } });
  const { bootConsole } = await import(${JSON.stringify(at('test/fake-game.mjs'))});
  const c = await bootConsole();
  const { G, N } = c;
  const out = { steps: [] };
  const sent = [];
  const net = G[N.net];
  Object.assign(net, {
    RELIABLE_CREATE_MATCH: 'CREATE', RELIABLE_KICK_USER: 'KICK', RELIABLE_CHAT: 'CHAT',
    [N.netChannel]: 1, [N.netReplyTo]: { reply: true }, [N.spectatorSlot]: -100, [N.spectatorSlots]: 16,
    [N.connUser]: { login: 'host', nickname: 'Host', is_guest: false },
    [N.lobbyConn]: { [N.netSend]: (channel, parts, reply) => sent.push({ channel, parts, reply }) },
    [N.enterMatch]: (...a) => out.steps.push(['enter', ...a]),
    matches: [],
  });
  out.chatTrace = G[N.chatTrace]; // set when the host started
  G[N.chatToAll] = 7; G[N.spectating] = false;
  G.gotoAndStop = (label) => { out.steps.push(['goto', label]); G.stage.currentFrameLabel = label; };
  const tick = c.intervals[c.intervals.length - 1];

  G.stage.currentFrameLabel = 'menu';
  tick(); // menu -> lobby
  tick(); // not logged in yet
  out.beforeLogin = sent.length;
  net[N.lobbyReady] = net[N.lobbyConn];
  tick(); // create
  const create = sent.shift();
  out.create = { channel: create.channel, type: create.parts[0], settings: JSON.parse(create.parts[1]), replyTo: create.parts[2] === net[N.netReplyTo] };
  out.createSettings = G[N.createSettings];
  out.ask = net[N.acceptManually];
  create.reply(['ok', '[1,2,"offer"]', 3]);
  out.password = G[N.joinPassword];

  const conn = (login, nickname, id, extra = {}) => ({
    [N.connUser]: { login, nickname, is_guest: false }, [N.connStats]: { reputation: 5 }, ping: 42,
    [N.connPlayer]: { hea: 100, team: 1, [N.connSpectator]: false }, [N.connSay]: (t) => out.steps.push(['say', login, t]), ...extra,
  });
  const host = conn('host', 'Host', 1), friend = conn('Friend', 'Pal', 2), stranger = conn('stranger', 'Who', 3);
  const ids = new WeakMap([[host, { id: 1 }], [friend, { id: 2 }], [stranger, { id: 3 }]]);
  G[N.p2pAuth] = { [N.p2pAuthIds]: ids };
  const setMap = [];
  const match = { players_max: 8, map_name: 'Nanotech', map_id: 'nanotech-cht', [N.matchSlots]: [host, null, friend, stranger], [N.mapText]: '<old/>', [N.matchSetMap]: (parts) => { setMap.push(parts); match[N.mapText] = parts[0]; } };
  net.matches = [match];
  net.match_details = { uid: 77 };
  G.stage.currentFrameLabel = 'gaming';
  c.log.printed.length = 0;
  tick(); // running
  tick(); // spectate, arrivals, allow list
  out.printed = c.log.printed.slice();
  out.sent = sent.map((s) => s.parts.map((p) => (typeof p === 'object' ? 'REPLY' : p)));
  out.who = c.run('who');
  out.say = c.run('say hello there');
  out.chat = c.log.net.filter((e) => e[0] === 'CHAT');
  out.kickUnknown = c.run('kick nobody');

  G.fetch = async (url, opt) => ({ ok: true, text: async () => (String(opt.body).includes('cmap=local-arena') ? '<map>\\n<player x="1"/>\\n</map>' : '<not_published />') });
  c.run('server map local arena');
  await new Promise((r) => setTimeout(r, 10));
  out.setMap = setMap.slice();
  tick();
  out.setMapAfterTick = setMap.length; // held: not sent again while the match has it
  match[N.mapText] = '<server sent another/>';
  tick();
  out.setMapAgain = setMap.length;
  out.missing = c.run('server map local nothing');
  await new Promise((r) => setTimeout(r, 10));
  out.missingLater = c.log.printed.slice();

  net.matches = [];
  c.log.printed.length = 0;
  tick();
  out.gone = c.log.printed.slice();
  out.status = c.run('server status');
  out.help = c.run('help server');
  process.stdout.write(JSON.stringify(out));
`;

test('dedicated host: logs in, creates the match as the create screen does, spectates, keeps the allow list and the local map', () => {
  const out = childOut(HOST_CHILD);
  assert.equal(out.chatTrace, true);
  assert.deepEqual(out.steps.find((s) => s[0] === 'goto'), ['goto', 'MPLobby']);
  assert.equal(out.beforeLogin, 0);
  assert.equal(out.create.type, 'CREATE');
  assert.equal(out.create.channel, 1);
  assert.equal(out.create.replyTo, true);
  assert.equal(out.create.settings.p2p, true);
  assert.equal(out.create.settings.ranked, false);
  assert.equal(out.create.settings.title, 'Game by Host');
  assert.equal(out.create.settings.p2p_region, 'Asia');
  assert.deepEqual(out.createSettings, out.create.settings);
  assert.equal(out.ask, false);
  assert.deepEqual(out.steps.find((s) => s[0] === 'enter'), ['enter', '[1,2,"offer"]', 3]);
  assert.equal(out.password, 'pw');

  // The "Spectate" button's message, then the stranger kicked by auth id.
  assert.deepEqual(out.sent[0], ['JOIN', 77, 'REPLY', -100, '', 'pw']);
  assert.deepEqual(out.sent[1], ['KICK', '3', 'REPLY', '0']);
  assert.ok(out.steps.some((s) => s[0] === 'say' && s[1] === 'stranger' && /invited players only/.test(s[2])));
  assert.ok(out.printed.some((l) => /^\+ Pal \(Friend\) joined: slot 2/.test(l)));
  assert.ok(out.printed.some((l) => /Who \(stranger\) is not on the "allow" list/.test(l)));
  assert.ok(!out.printed.some((l) => /Host.*joined/.test(l)), 'the host itself is not announced');

  assert.match(out.who.join('\n'), /2 of 8 players/);
  assert.match(out.who.join('\n'), /Host \(host\)\s+\[this host\]/);
  assert.match(out.who.join('\n'), /Pal \(Friend\)\s+42 ms/);
  assert.deepEqual(out.chat, [['CHAT', 'n7', 'hello there']]);
  assert.match(out.kickUnknown.join(' '), /no player "nobody"/);

  assert.equal(out.setMap.length, 1);
  assert.deepEqual(out.setMap[0], ['<map>\n<player x="1"/>\n</map>', 'arena', '0', '8', 'local-arena']);
  assert.equal(out.setMapAfterTick, 1);
  assert.equal(out.setMapAgain, 2, 'a map from the lobby server is replaced by the held local map');
  assert.ok(out.missingLater.some((l) => /no map "nothing" in desktop\/maps/.test(l)));

  assert.ok(out.gone.some((l) => /the match is gone/.test(l)));
  assert.ok(out.gone.some((l) => /starting again in 5 s/.test(l)));
  assert.match(out.status.join('\n'), /waiting to start again/);
  assert.match(out.help.join('\n'), /player-hosted match/);
});
