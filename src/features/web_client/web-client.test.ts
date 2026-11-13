import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWebClient } from './services/web-client.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GAME = path.join(REPO, 'game');
const HAS_GAME = fs.existsSync(path.join(GAME, 'index.html'));
const quiet: any = { info() {}, warn() {}, error() {}, debug() {}, on: () => false };

async function withWebClient(pageFiles: Record<string, string>, run: (base: string, warnings: string[]) => Promise<void>) {
  const pageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-web-page-'));
  for (const [name, text] of Object.entries(pageFiles)) fs.writeFileSync(path.join(pageDir, name), text);
  const warnings: string[] = [];
  const handler = createWebClient({
    gameDir: GAME, pageDir, namesScript: 'globalThis.PB2_NAMES = {};', serverName: 'Pal\'s <server>', publicUrl: 'https://pb2.example.test', log: { ...quiet, warn: (line: string) => warnings.push(line) },
  });
  const server = http.createServer((request, response) => { if (!handler(request, response)) { response.writeHead(418); response.end(); } });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  try {
    await run(`http://127.0.0.1:${port}`, warnings);
  } finally {
    server.close();
    fs.rmSync(pageDir, { recursive: true, force: true });
  }
}

const rawStatus = (base: string, rawPath: string) => new Promise<number>((resolve, reject) => {
  const { hostname, port } = new URL(base);
  http.get({ hostname, port, path: rawPath }, (response) => { response.resume(); resolve(response.statusCode ?? 0); }).on('error', reject);
});

const play = (base: string, body: string) => fetch(`${base}/play/`, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, redirect: 'manual' });

test('web client: the join page asks for a nickname, with the server\'s name escaped', { skip: !HAS_GAME && 'no game files' }, () => withWebClient({ 'page.js': '' }, async (base) => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /name="nickname"/);
  assert.match(html, /Pal&#39;s &lt;server&gt;/);
  assert.match(response.headers.get('content-security-policy') ?? '', /form-action 'self'/);
}));

test('web client: playing serves the game with the page core and a join target back to this site, and the page may connect nowhere else', { skip: !HAS_GAME && 'no game files' }, () => withWebClient({ 'page.js': '' }, async (base) => {
  const response = await play(base, 'nickname=Pal&password=pw');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /PB2_JOIN/);
  assert.match(html, /"address":"pb2\.example\.test"/, 'the public address, not the request\'s');
  assert.match(html, /"nickname":"Pal"/);
  assert.match(html, /<script src="__dev\/names\.js"><\/script>/);
  assert.match(html, /<script type="module" src="__dev\/page\/page\.js"><\/script>/);
  assert.doesNotMatch(html, /console\.js/, 'no dev console');
  const policy = response.headers.get('content-security-policy') ?? '';
  assert.match(policy, /connect-src 'self'/);
  assert.doesNotMatch(policy, /plazmaburst2|sadburst/);
  assert.equal((await play(base, 'nickname=&password=')).status, 400);
}));

test('web client: game files, names and the page bundle are served; nothing outside them', { skip: !HAS_GAME && 'no game files' }, () => withWebClient({ 'page.js': 'export {};' }, async (base) => {
  const strings = await fetch(`${base}/play/_strings.js`);
  assert.equal(strings.status, 200);
  assert.match(strings.headers.get('content-type') ?? '', /javascript/);
  assert.equal(await (await fetch(`${base}/play/__dev/names.js`)).text(), 'globalThis.PB2_NAMES = {};');
  assert.equal(await (await fetch(`${base}/play/__dev/page/page.js`)).text(), 'export {};');
  assert.equal(await rawStatus(base, '/play/%2e%2e/package.json'), 418, '".." resolves to /package.json, outside /play/: not the web client\'s, so the server\'s 404');
  assert.equal(await rawStatus(base, '/play/scripts/..%2f..%2fpackage.json'), 404, 'an escaped "/" is still a separator, and ".." is refused');
  assert.equal((await fetch(`${base}/play/index.html`)).status, 404, 'the game page only through the join form');
  assert.equal((await fetch(`${base}/play/`, { redirect: 'manual' })).status, 303, 'a reload goes back to the form');
  assert.equal((await fetch(`${base}/status`)).status, 418, 'other routes are the server\'s');
}));

test('web client: without a page bundle it says so, and plays nothing', { skip: !HAS_GAME && 'no game files' }, () => withWebClient({}, async (base, warnings) => {
  assert.ok(warnings.some((line) => /no page bundle/.test(line)));
  assert.equal((await play(base, 'nickname=Pal')).status, 503);
}));
