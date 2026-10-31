// Your own server ("npm run server", server/) and joining it ("npm run join"): their
// settings, and the game's own server code run against the game's own client code.
// The end-to-end test needs the game files (game/) and is skipped without them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { checkConfig } = require('../server/config.js');
const { memberShapes } = require('../server/game.js');
const { checkJoin, parseAddress, normalFingerprint } = require('../desktop/join.js');
const HAS_GAME = fs.existsSync(path.join(REPO, 'game', 'scripts', 'libs', 'flash.js'));

const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, '0').toUpperCase()).join(':');

test('server config: defaults, checks, the open-server warning', () => {
  const d = checkConfig({});
  assert.deepEqual(d.errors, []);
  assert.equal(d.server.port, 2053);
  assert.ok(d.problems.some((p) => /anyone who can reach/.test(p)));
  const r = checkConfig({ password: 'pw', nicknames: ['Pal ', 'pal', 'Bob'], admins: ['Me'], cheat_reports: 'kick', nope: 1, _c: 'x' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.server.nicknames, ['pal', 'bob']);
  assert.ok(r.problems.some((p) => /nope: unknown/.test(p)));
  const bad = checkConfig({ port: 70000, nicknames: ['<b>'], cheat_reports: 'ban', download_maps: 'yes', skin: -1 });
  for (const want of [/port/, /nicknames/, /cheat_reports/, /download_maps/, /skin/]) assert.ok(bad.errors.some((e) => want.test(e)), String(want));
});

test('join config: address, pinned fingerprint, nickname', () => {
  assert.deepEqual(parseAddress('203.0.113.5:2054'), { host: '203.0.113.5', port: 2054, hostPort: '203.0.113.5:2054' });
  assert.equal(parseAddress('my.host').port, 2053);
  assert.equal(parseAddress('[::1]:9').host, '::1');
  assert.throws(() => parseAddress('a b:1'));
  assert.equal(normalFingerprint(FP.toLowerCase().replace(/:/g, '')), FP);
  const ok = checkJoin({ address: 'https://1.2.3.4:2053/', fingerprint: FP.toLowerCase(), nickname: ' Pal ', password: 'pw' });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.join.hostPort, '1.2.3.4:2053');
  assert.equal(ok.join.nickname, 'Pal');
  const bad = checkJoin({ address: '', fingerprint: 'abc', nickname: '' });
  assert.equal(bad.errors.length, 3);
});

test('the account module is built from how the game uses it', () => {
  const src = 'A.$m.get(1); A.$m.set(c,{}); A.$l.length; A.$l[i]; A.$f(conn); x=A.$k; A.$f2(a,A.$k2,"",null);';
  assert.deepEqual(memberShapes(src, 'A'), { $m: 'map', $l: 'list', $f: 'fn', $k: 'value', $f2: 'fn', $k2: 'value' });
});

// The console in join mode is decided when its modules load: its own process.
test('join mode: the lobby address points at the server, the login is set from the menu on', () => {
  const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
    Object.defineProperty(globalThis, 'PB2_JOIN', { value: { address: '1.2.3.4:2053', nickname: 'Pal', password: 'pw' } });
    const { bootConsole } = await import(${JSON.stringify(pathToFileURL(path.join(REPO, 'test/fake-game.mjs')).href)});
    globalThis.loaderInfo = { parameters: { l: '', p: '' } };
    const c = await bootConsole();
    const net = c.G[c.N.net];
    net[c.N.lobbyHosts] = ['', 'https://vvvv.', 'https://www.'];
    const tick = c.intervals[c.intervals.length - 1];
    c.G.stage.currentFrameLabel = 'loading';
    tick();
    const before = { ...globalThis.loaderInfo.parameters };
    c.G.stage.currentFrameLabel = 'menu';
    tick();
    process.stdout.write(JSON.stringify({ hosts: net[c.N.lobbyHosts], before, after: globalThis.loaderInfo.parameters, said: c.log.printed.filter((l) => /Private server/.test(l)) }));
  `], { cwd: REPO, encoding: 'utf8' }));
  assert.deepEqual(out.hosts, ['https://1.2.3.4:2053/?', 'https://1.2.3.4:2053/?', 'https://1.2.3.4:2053/?']);
  assert.deepEqual(out.before, { l: '', p: '' }, 'nothing during start-up, when the game talks to the official site');
  assert.deepEqual(out.after, { l: 'Pal', p: 'pw' });
  assert.ok(out.said.some((l) => /Multiplayer connects there, as Pal/.test(l)), out.said.join('\n'));
});

test('own server: the game\'s server code logs players in, lists, creates and joins matches, and obeys its terminal', { skip: !HAS_GAME && 'no game files' }, async () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // the client trusts the test server's self-signed certificate
  const { findNames } = require('../tools/find-names.js');
  const { createClient } = require('./game-client.cjs');
  const N = findNames(path.join(REPO, 'game')).found;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-server-'));
  fs.mkdirSync(path.join(dir, 'maps'));
  const cfg = path.join(dir, 'server.json');
  fs.writeFileSync(cfg, JSON.stringify({ port: 0, bind: '127.0.0.1', password: 'pw', welcome: 'hi there', download_maps: false }));
  const srv = spawn(process.execPath, [path.join(REPO, 'server/index.js'), '--config', cfg, '--data', dir], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  srv.stdout.on('data', (d) => { out += d; });
  srv.stderr.on('data', (d) => { out += d; });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms = 8000) => { for (let t = 0; t < ms; t += 50) { if (fn()) return true; await wait(50); } return false; };
  const clients = [];
  try {
    assert.ok(await until(() => /server on 127\.0\.0\.1:\d+/.test(out)), out);
    const url = `https://127.0.0.1:${out.match(/server on 127\.0\.0\.1:(\d+)/)[1]}`;
    const client = () => { const c = createClient({ gameDir: path.join(REPO, 'game'), names: N, url }); clients.push(c); return c; };
    const a = client();
    const b = client();
    assert.deepEqual(await b.login('Bob', 'nope'), ['fail', 'Server: Wrong server password (desktop/join.json "password")']);
    assert.equal((await a.login('Alice', 'pw'))[0], 'ok');
    assert.deepEqual(await client().login('alice', 'pw'), ['fail', 'Server: That nickname is already playing here']);
    await wait(3100); // the game allows one login per connection every 3 s
    const bob = await b.login('Bob', 'pw');
    assert.equal(bob[0], 'ok');
    assert.equal(JSON.parse(bob[1]).nickname, 'Bob');

    const map = fs.readdirSync(path.join(REPO, 'desktop', 'maps')).find((f) => f.endsWith('.xml'));
    const preset = { ranked: false, max_players: 8, game_type: 'DM', min_reputation: 0, map_rotation: '', title: 'Friends', map_id: `local-${map ? map.slice(0, -4) : 'none'}`, password: '', gameplay_modifications: '', ping_limit: '', rounds_until_rotation: '15', round_duration_str: 'default', round_duration: 0, p2p: false, p2p_region: '', exclude_inactive_players: true, allow_vpn_guests: 1, ping_limit_action: 'spectate', respawn_model: 'v2', accept_connections_manually: false };
    if (map) {
      assert.deepEqual((await a.create(preset)).slice(0, 1), ['ok']);
      const list = JSON.parse((await b.list())[1]);
      assert.equal(list.length, 1);
      assert.equal(list[0].title, 'Friends');
      assert.equal(list[0].can_join, true);
      assert.equal((await b.join(list[0].uid))[0], 'ok');
      assert.ok(await until(() => b.net[N.mapChunks] && b.net[N.mapChunks].length > 0), 'Bob gets the map');
      srv.stdin.write('matches\nwho\n');
      assert.ok(await until(() => /1\. "Friends"/.test(out) && /2\/8 players/.test(out)), out);
    }
    assert.ok(await until(() => b.chat.some((l) => /hi there/.test(l))), 'the welcome line');
    srv.stdin.write('say server says hi\n');
    assert.ok(await until(() => b.chat.some((l) => /Server \* server says hi/.test(l))));
    srv.stdin.write('ban bob\n');
    assert.ok(await until(() => b.closed()), 'kicked');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'bans.json'), 'utf8')), ['bob']);
    const again = client();
    assert.deepEqual(await again.login('Bob', 'pw'), ['fail', 'Server: You are banned from this server']);
    assert.match(out, /\+ Alice logged in/);
    assert.match(out, /- Bob disconnected/);
  } finally {
    for (const c of clients) c.close();
    srv.stdin.write('quit\n');
    await wait(700);
    srv.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
