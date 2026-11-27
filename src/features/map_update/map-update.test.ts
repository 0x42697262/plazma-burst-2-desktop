import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findNames } from '#tools/find-names/find-names.ts';
import { createClient } from '#server/testing/game-client.fixture.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const HAS_GAME = fs.existsSync(path.join(REPO, 'game', 'scripts', 'libs', 'flash.js'));
const VERSION_ONE = '<q.^f10^Q20^030^Q40" />';
const VERSION_TWO = '<q.^f11^Q21^031^Q41" />';
const ONE_LOGIN_EVERY_3_SECONDS = 3100;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function startServer(configFields: Record<string, unknown>, environment: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-map-update-'));
  const config = path.join(dir, 'server.json');
  fs.writeFileSync(config, JSON.stringify({ port: 0, bind: '127.0.0.1', password: 'pw', admins: { Boss: 'the-boss-secret' }, match_list_gap_ms: 0, ...configFields }));
  const server = spawn(process.execPath, [path.join(REPO, 'src/server/index.ts'), '--config', config, '--data', dir], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...environment } });
  const output = { text: '' };
  server.stdout.on('data', (data) => { output.text += data; });
  server.stderr.on('data', (data) => { output.text += data; });
  const until = async (condition: () => unknown, ms = 10000) => { for (let waited = 0; waited < ms; waited += 50) { if (condition()) return true; await wait(50); } return false; };
  const stop = async () => {
    server.stdin.write('quit\n');
    await wait(700);
    server.kill();
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { server, output, until, stop, type: (line: string) => { server.stdin.write(line + '\n'); } };
}

test('map update: an admin downloads a match\'s map again in game and in the terminal, and "now" reloads the match', { skip: !HAS_GAME && 'no game files' }, async () => {
  const trustTheTestServersSelfSignedCertificate = '0';
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = trustTheTestServersSelfSignedCertificate;
  const mapId = `zz-map-update-test-${process.pid}`;
  const savedMap = path.join(REPO, 'data', 'maps', `${mapId}.xml`);
  const site = { answer: VERSION_ONE, asked: 0 };
  const mapSite = http.createServer((_request, response) => { site.asked++; response.end(site.answer); });
  await new Promise<void>((resolve) => { mapSite.listen(0, '127.0.0.1', resolve); });
  const sitePort = (mapSite.address() as { port: number }).port;
  const running = startServer({ download_maps: true, map_sources: [{ type: 'http', url: `http://127.0.0.1:${sitePort}/pb2/server.php` }] });
  const { output, until, type } = running;
  const names: any = findNames(path.join(REPO, 'game')).found;
  const clients: any[] = [];
  try {
    assert.ok(await until(() => /" on 127\.0\.0\.1:\d+/.test(output.text)), output.text);
    const url = `https://127.0.0.1:${output.text.match(/" on 127\.0\.0\.1:(\d+)/)?.[1]}`;
    const client = () => { const created = createClient({ gameDir: path.join(REPO, 'game'), names, url }); clients.push(created); return created; };
    const alice = client();
    assert.equal((await alice.login('Alice', 'pw'))[0], 'ok');
    const preset = { ranked: false, max_players: 8, game_type: 'DM', min_reputation: 0, title: 'Update me', map_id: mapId, map_rotation: '', password: '', gameplay_modifications: '', ping_limit: '', rounds_until_rotation: '15', round_duration_str: 'default', round_duration: 0, p2p: false, p2p_region: '', exclude_inactive_players: true, allow_vpn_guests: 1, ping_limit_action: 'spectate', respawn_model: 'v2', accept_connections_manually: false };
    assert.equal((await alice.list())[0], 'ok');
    await wait(ONE_LOGIN_EVERY_3_SECONDS);
    const created = await alice.create(preset);
    assert.deepEqual(created.slice(0, 1), ['ok'], JSON.stringify(created) + output.text);
    assert.match(fs.readFileSync(savedMap, 'utf8'), /x="10"/, 'the first version is downloaded and saved');
    await wait(ONE_LOGIN_EVERY_3_SECONDS);
    const boss = client();
    assert.equal((await boss.login('boss', 'the-boss-secret'))[0], 'ok');
    const list = JSON.parse((await boss.list())[1]);
    await wait(ONE_LOGIN_EVERY_3_SECONDS);
    const joined = await boss.join(list[0].uid);
    assert.equal(joined[0], 'ok', JSON.stringify(joined));
    site.answer = VERSION_TWO;

    alice.say('-mapupdate');
    boss.say('hello -mapupdate');
    await wait(700);
    assert.doesNotMatch(output.text, /asked to update/, 'not an admin, or not the command: nothing happens');
    assert.equal(site.asked, 1);

    boss.say('-mapupdate');
    assert.ok(await until(() => boss.chat.some((line: string) => line.includes(`Updated ${mapId}. "-mapupdate now" reloads this match`))), `${boss.chat.join('\n')}\n${output.text}`);
    assert.match(fs.readFileSync(savedMap, 'utf8'), /x="11"/, 'the saved copy is the new version');
    assert.ok(!alice.chat.some((line: string) => line.includes('reloading')), 'without "now" the match keeps playing');

    boss.say('-mapupdate now');
    assert.ok(await until(() => alice.chat.some((line: string) => line.includes('This map was updated by boss: reloading'))), alice.chat.join('\n'));
    assert.ok(await until(() => output.text.includes(`Updated ${mapId}; reloaded "Update me"`)), output.text);

    type('maps update');
    assert.ok(await until(() => output.text.includes('usage: maps update <map ID | #match> [now]')), output.text);
    type('maps update #1 now');
    assert.ok(await until(() => alice.chat.some((line: string) => line.includes('This map was updated by the server admin: reloading'))), alice.chat.join('\n'));
    site.answer = '<not_published />';
    type(`maps update ${mapId}`);
    assert.ok(await until(() => output.text.includes(`${mapId} was not updated: "${mapId}" is not published: the saved copy is kept`)), output.text);
    assert.match(fs.readFileSync(savedMap, 'utf8'), /x="11"/);
    type('help');
    assert.ok(await until(() => output.text.includes('maps update <map ID>')), output.text);
  } finally {
    for (const created of clients) created.close();
    await running.stop();
    mapSite.close();
    fs.rmSync(savedMap, { force: true });
  }
});

test('map update: with the flag off there is no maps command and -mapupdate is only chat', { skip: !HAS_GAME && 'no game files' }, async () => {
  const running = startServer({ download_maps: false }, { PB2_FEATURES: '-map_update' });
  try {
    assert.ok(await running.until(() => /Type "help"/.test(running.output.text)), running.output.text);
    running.type('maps update x');
    assert.ok(await running.until(() => running.output.text.includes('Unknown command "maps"')), running.output.text);
    running.type('help');
    await wait(300);
    assert.doesNotMatch(running.output.text, /maps update/);
  } finally {
    await running.stop();
  }
});
