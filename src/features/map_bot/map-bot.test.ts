import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findNames } from '#tools/find-names/find-names.ts';
import { readAccount } from './adapters/account.ts';
import { connectLobby, type LobbyClient } from './adapters/lobby-client.ts';
import { fetchMapFromLobby } from './services/fetch-map.ts';
import { LOBBY_CLIENT } from './keys.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GAME = path.join(REPO, 'game');
const HAS_GAME = fs.existsSync(path.join(GAME, '_strings.js'));
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

test('map bot: the account file is the login and the md5 of the password, like data/credentials.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-bot-account-'));
  try {
    const file = path.join(dir, 'account.json');
    assert.throws(() => readAccount(file), /no account in/);
    fs.writeFileSync(file, JSON.stringify({ login: 'Bot', password: 'plain text' }));
    assert.throws(() => readAccount(file), /password/);
    const md5 = crypto.createHash('md5').update('secret').digest('hex');
    fs.writeFileSync(file, JSON.stringify({ login: 'Bot', password: md5, pb2uid: '1' }));
    assert.deepEqual(readAccount(file), { login: 'Bot', password: md5 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('map bot: the login fields are the game\'s own', { skip: !HAS_GAME && 'no game files' }, () => {
  const strings = fs.readFileSync(path.join(GAME, '_strings.js'), 'utf8');
  for (const value of Object.values(LOBBY_CLIENT)) assert.ok(strings.includes(`'${value}'`), value);
});

test('map bot: logs in to a lobby, creates a private match, gets its map, and never acts as the page\'s main connection', { skip: !HAS_GAME && 'no game files' }, async () => {
  const trustTheTestServersSelfSignedCertificate = '0';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = trustTheTestServersSelfSignedCertificate;
  const names: any = findNames(GAME).found;
  const mapFile = fs.readdirSync(path.join(REPO, 'data', 'maps')).find((file) => file.endsWith('.xml'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-bot-'));
  const cfg = path.join(dir, 'server.json');
  fs.writeFileSync(cfg, JSON.stringify({ port: 0, bind: '127.0.0.1', password: '', download_maps: false }));
  const srv = spawn(process.execPath, [path.join(REPO, 'src/server/index.ts'), '--config', cfg, '--data', dir], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  srv.stdout.on('data', (data) => { out += data; });
  srv.stderr.on('data', (data) => { out += data; });
  const clients: LobbyClient[] = [];
  try {
    for (let waited = 0; waited < 8000 && !/" on 127\.0\.0\.1:\d+/.test(out); waited += 50) await sleep(50);
    const url = `https://127.0.0.1:${out.match(/" on 127\.0\.0\.1:(\d+)/)?.[1]}`;
    const account = { login: 'MapBot', password: crypto.createHash('md5').update('any').digest('hex') };
    const connect = () => { const client = connectLobby({ gameDir: GAME, names, url }); clients.push(client); return client; };
    if (mapFile) {
      const id = mapFile.slice(0, -'.xml'.length);
      const map = await fetchMapFromLobby(id, { connect, account, sleep });
      assert.equal(map?.trim(), fs.readFileSync(path.join(REPO, 'data', 'maps', mapFile), 'utf8').replace(/^\uFEFF/, '').trim(), 'the map the lobby sends, piece by piece');
    }
    await sleep(3100);
    await assert.rejects(fetchMapFromLobby('no-such-map-here', { connect, account, sleep }), /did not create the match/, 'this server downloads no maps: a refusal, not "not published"');
    assert.ok(clients.length > 0 && clients.every((client) => !client.isRegisteredAsMainServer()), 'the page runs a lobby\'s tasks only for its main connection, and the bot never is one');
    assert.match(out, /\+ MapBot logged in/);
  } finally {
    for (const client of clients) client.close();
    srv.stdin.write('quit\n');
    await sleep(700);
    srv.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
