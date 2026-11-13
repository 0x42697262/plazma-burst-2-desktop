import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkConfig } from './config.ts';
import { memberShapes } from './game.ts';
import { createMaps } from './maps.ts';
import { createProbe } from '#features/server_list/adapters/probe.ts';
import { checkServer as checkEntry } from '#features/server_list/domain/server.ts';
import { findNames } from '#tools/find-names/find-names.ts';
import { makeUnpacker } from '#kernel/maps/map-text.ts';
import { createClient } from './testing/game-client.fixture.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const probe = createProbe();
const checkServer = (entry: unknown) => checkEntry(entry, () => 'testserver1');
const HAS_GAME = fs.existsSync(path.join(REPO, 'game', 'scripts', 'libs', 'flash.js'));

const FP = Array.from({ length: 32 }, (_, index) => index.toString(16).padStart(2, '0').toUpperCase()).join(':');

test('server config: defaults, checks, the open-server warning', () => {
  const defaults = checkConfig({});
  assert.deepEqual(defaults.errors, []);
  assert.equal(defaults.server?.port, 2053);
  assert.ok(defaults.problems.some((problem) => /anyone who can reach/.test(problem)));
  const checked = checkConfig({ password: 'pw', nicknames: ['Pal ', 'pal', 'Bob'], admins: ['Me'], cheat_reports: 'kick', nope: 1, _c: 'x' });
  assert.deepEqual(checked.errors, []);
  assert.deepEqual(checked.server?.nicknames, ['pal', 'bob']);
  assert.ok(checked.problems.some((problem) => /nope: unknown/.test(problem)));
  const withSecrets = checkConfig({ admins: { Boss: 'a-long-secret' } });
  assert.deepEqual(withSecrets.errors, []);
  assert.deepEqual(withSecrets.server?.admins, ['boss']);
  assert.deepEqual(withSecrets.server?.admin_secrets, { boss: 'a-long-secret' });
  assert.ok(checkConfig({ admins: ['Me'] }).problems.some((problem) => /anyone who logs in as "me"/.test(problem)), 'an admin without a secret on a server without a password');
  assert.ok(!checkConfig({ password: 'pw', admins: ['Me'] }).problems.some((problem) => /anyone who logs in as/.test(problem)), 'the server password guards them');
  assert.ok(checkConfig({ admins: { Boss: 'short' } }).errors.some((error) => /admins: .*8/.test(error)), 'a short secret');
  const bad = checkConfig({ port: 70000, nicknames: ['<b>'], cheat_reports: 'ban', download_maps: 'yes', skin: -1 });
  for (const want of [/port/, /nicknames/, /cheat_reports/, /download_maps/, /skin/]) assert.ok(bad.errors.some((error) => want.test(error)), String(want));
});

test('the account module is built from how the game uses it', () => {
  const src = 'A.$m.get(1); A.$m.set(c,{}); A.$l.length; A.$l[i]; A.$f(conn); x=A.$k; A.$f2(a,A.$k2,"",null);';
  assert.deepEqual(memberShapes(src, 'A'), { $m: 'map', $l: 'list', $f: 'fn', $k: 'value', $f2: 'fn', $k2: 'value' });
});

test('own server: the game\'s server code logs players in, lists, creates and joins matches, and obeys its terminal', { skip: !HAS_GAME && 'no game files' }, async () => {
  const trustTheTestServersSelfSignedCertificate = '0';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = trustTheTestServersSelfSignedCertificate;
  const names: any = findNames(path.join(REPO, 'game')).found;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-server-'));
  fs.mkdirSync(path.join(dir, 'maps'));
  const cfg = path.join(dir, 'server.json');
  const map = fs.readdirSync(path.join(REPO, 'data', 'maps')).find((file) => file.endsWith('.xml'));
  fs.writeFileSync(cfg, JSON.stringify({ port: 0, bind: '127.0.0.1', password: 'pw', admins: { Boss: 'the-boss-secret' }, welcome: 'hi there', download_maps: false, random_maps: map ? [map.slice(0, -4)] : [] }));
  const srv = spawn(process.execPath, [path.join(REPO, 'src/server/index.ts'), '--config', cfg, '--data', dir], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  srv.stdout.on('data', (data) => { out += data; });
  srv.stderr.on('data', (data) => { out += data; });
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const until = async (condition: () => unknown, ms = 8000) => { for (let waited = 0; waited < ms; waited += 50) { if (condition()) return true; await wait(50); } return false; };
  const clients: any[] = [];
  try {
    assert.ok(await until(() => /" on 127\.0\.0\.1:\d+/.test(out) && /fingerprint: [0-9A-F:]{95}/.test(out)), out);
    const url = `https://127.0.0.1:${out.match(/" on 127\.0\.0\.1:(\d+)/)?.[1]}`;
    const port = Number(out.match(/" on 127\.0\.0\.1:(\d+)/)?.[1]);
    const fingerprint = out.match(/fingerprint: ([0-9A-F:]{95})/)?.[1];
    assert.equal(await probe.fingerprint('127.0.0.1', port), fingerprint);
    const entry: any = checkServer({ address: `127.0.0.1:${port}`, fingerprint, nickname: 'Pal' }).server;
    const status: any = await probe.status(entry);
    assert.equal(status.password, true);
    assert.equal(status.players, 0);
    assert.equal(typeof status.name, 'string');
    assert.ok(Object.keys(status).every((key) => ['name', 'description', 'version', 'password', 'players', 'max_players', 'matches'].includes(key)), 'nothing private');
    await assert.rejects(probe.status({ ...entry, fingerprint: FP }), (error: any) => error.pinned === false, 'another certificate: no status');
    assert.equal(typeof await probe.ping('127.0.0.1', port), 'number');
    const client = () => { const created = createClient({ gameDir: path.join(REPO, 'game'), names, url }); clients.push(created); return created; };
    const alice = client();
    const bob = client();
    assert.deepEqual(await bob.login('Bob', 'nope'), ['fail', 'Server: Wrong server password (Servers > Server list > Edit)']);
    assert.equal((await alice.login('Alice', 'pw'))[0], 'ok');
    assert.equal((await alice.list())[0], 'ok', 'the lobby asks for the match list right after logging in, well within 300 ms of connecting');
    assert.deepEqual(await client().login('alice', 'pw'), ['fail', 'Server: That nickname is already playing here']);
    const oneLoginPerConnectionEvery3Seconds = 3100;
    await wait(oneLoginPerConnectionEvery3Seconds);
    const bobLogin = await bob.login('Bob', 'pw');
    assert.equal(bobLogin[0], 'ok');
    assert.equal(JSON.parse(bobLogin[1]).nickname, 'Bob');

    const preset = { ranked: false, max_players: 8, game_type: 'DM', min_reputation: 0, title: 'Friends', map_id: 'random approved in rotation', map_rotation: 'random approved in rotation', password: '', gameplay_modifications: '', ping_limit: '', rounds_until_rotation: '15', round_duration_str: 'default', round_duration: 0, p2p: false, p2p_region: '', exclude_inactive_players: true, allow_vpn_guests: 1, ping_limit_action: 'spectate', respawn_model: 'v2', accept_connections_manually: false };
    if (map) {
      assert.deepEqual((await alice.create(preset)).slice(0, 1), ['ok']);
      const list = JSON.parse((await bob.list())[1]);
      assert.equal(list.length, 1);
      assert.equal(list[0].title, 'Friends');
      assert.equal(list[0].map_id, map.slice(0, -4), 'the create screen\'s default map ID, "random approved in rotation", became the map from random_maps');
      assert.equal(list[0].can_join, true);
      assert.equal((await bob.join(list[0].uid))[0], 'ok');
      assert.ok(await until(() => bob.net[names.mapChunks] && bob.net[names.mapChunks].length > 0), 'Bob gets the map');
      srv.stdin.write('matches\nwho\n');
      assert.ok(await until(() => /1\. "Friends"/.test(out) && /2\/8 players/.test(out)), out);
    }
    assert.ok(await until(() => bob.chat.some((line: string) => /hi there/.test(line))), 'the welcome line');
    srv.stdin.write('say server says hi\n');
    assert.ok(await until(() => bob.chat.some((line: string) => /Server \* server says hi/.test(line))));
    srv.stdin.write('ban bob\n');
    assert.ok(await until(() => bob.closed()), 'kicked');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'bans.json'), 'utf8')), ['bob']);
    assert.deepEqual(await client().login('Boss', 'pw'), ['fail', 'Server: That nickname belongs to an admin: give its secret as the password']);
    const boss = await client().login('boss', 'the-boss-secret');
    assert.equal(boss[0], 'ok', 'an admin logs in with the secret instead of the server password');
    assert.equal(JSON.parse(boss[1]).is_staff, true);
    const again = client();
    assert.deepEqual(await again.login('Bob', 'pw'), ['fail', 'Server: You are banned from this server']);
    assert.match(out, /\+ Alice logged in/);
    assert.match(out, /- Bob disconnected/);
  } finally {
    for (const created of clients) created.close();
    srv.stdin.write('quit\n');
    await wait(700);
    srv.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('maps: this server\'s first, then the site (unpacked to plain XML and kept in the same folder), only then missing', { skip: !HAS_GAME && 'no game files' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-maps-'));
  const mapsDir = path.join(dir, 'maps');
  fs.mkdirSync(mapsDir);
  fs.writeFileSync(path.join(mapsDir, 'mine.xml'), '<player x="1" y="2" />\n');
  const asked: { id: string | null; login: boolean }[] = [];
  const siteAnsweringCompressedOrNotPublished = async (_url: string, opt: any) => {
    const id = new URLSearchParams(String(opt.body)).get('cmap');
    asked.push({ id, login: new URLSearchParams(String(opt.body)).has('l') });
    return { ok: true, text: async () => (id === 'site-map' ? '<q.^f10^Q20^030^Q40" />' : '<not_published />') };
  };
  try {
    const maps = createMaps({ mapsDir, unpack: makeUnpacker(path.join(REPO, 'game')), fetch: siteAnsweringCompressedOrNotPublished as any });
    assert.equal(maps.local('local-mine'), '<player x="1" y="2" />');
    assert.equal(maps.local('site-map'), null);
    const xml = await maps.download('site-map');
    assert.equal(xml, '<player x="10" y="20" />\n<player x="30" y="40" />\n', 'unpacked, one tag per line');
    assert.equal(maps.local('site-map'), xml.trim(), 'kept: not downloaded again');
    assert.ok(fs.existsSync(path.join(mapsDir, 'site-map.xml')), 'kept in the one maps folder, where the game client saves maps too');
    assert.equal(await maps.download('nope'), null);
    assert.deepEqual(asked, [{ id: 'site-map', login: false }, { id: 'nope', login: false }], 'no login is sent');
    assert.deepEqual(maps.list().sort(), ['mine', 'site-map']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

