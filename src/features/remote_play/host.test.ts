import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { WebSocket } from 'ws';
import { buildRemoteClient } from '#tools/build/build.ts';
import { CLOSE } from './constants.ts';
import { addTester, findTester } from './adapters/testers-file.ts';
import { startHost, type RemoteGame } from './services/host.ts';
import type { InputEvent } from './domain/input.ts';

const SIZE = { width: 960, height: 540 };

let clientDir = '';
before(async () => { clientDir = await buildRemoteClient(fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-remote-client-'))); });
after(() => { fs.rmSync(clientDir, { recursive: true, force: true }); });

type FakeGame = RemoteGame & { name: string; inputs: InputEvent[]; destroyed: boolean; refreshed: number; focused: number; paint(bytes?: Buffer): number; crash(): void };

function fakeGame(name: string, record: FakeGame[]): FakeGame {
  const frameListeners = new Set<(encode: () => Buffer) => void>();
  const goneListeners: (() => void)[] = [];
  const game: FakeGame = {
    name, inputs: [], destroyed: false, refreshed: 0, focused: 0,
    size: { ...SIZE },
    onFrame(listener) { frameListeners.add(listener); return () => { frameListeners.delete(listener); }; },
    sendInput(event) { game.inputs.push(event); },
    focus() { game.focused++; },
    refresh() { game.refreshed++; },
    destroy() { game.destroyed = true; },
    onGone(listener) { goneListeners.push(listener); },
    paint(bytes = Buffer.from([0xff, 0xd8, 0xff])) {
      let sent = 0;
      for (const listener of frameListeners) listener(() => { sent++; return bytes; });
      return sent;
    },
    crash() { for (const listener of goneListeners) listener(); },
  };
  record.push(game);
  return game;
}

type ServerMessage = { t?: string; message?: string; [field: string]: unknown };
type Received = { json: ServerMessage[]; binary: Buffer[]; closed: number | null };

async function hostFixture(options: { startMs?: number; maxGames?: number; idleMs?: number } = {}) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-remote-'));
  const testersFile = path.join(folder, 'testers.json');
  const games: FakeGame[] = [];
  const logs: string[] = [];
  const record = (message: string) => { logs.push(message); };
  const log = { info: record, warn: record, error: record, debug: record };
  const { startMs = 0, ...hostOptions } = options;
  const host = startHost({
    port: 0, clientDir, log, fps: 1000, ...hostOptions,
    findTester: (token) => findTester(testersFile, token),
    createGame: async (tester) => {
      await new Promise((resolve) => setTimeout(resolve, startMs));
      return fakeGame(tester.name, games);
    },
  });
  const port = await host.ready;
  const base = `http://127.0.0.1:${port}`;
  const open = (token: string) => new Promise<{ socket: WebSocket; got: Received }>((resolve) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const got: Received = { json: [], binary: [], closed: null };
    socket.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) got.binary.push(data);
      else got.json.push(JSON.parse(String(data)) as ServerMessage);
    });
    socket.on('close', (code) => { got.closed = code; });
    socket.on('open', () => { socket.send(JSON.stringify({ t: 'hello', token })); resolve({ socket, got }); });
  });
  const until = async (condition: () => unknown, ms = 2000) => {
    const end = Date.now() + ms;
    while (!condition()) {
      if (Date.now() > end) throw new Error('timed out');
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };
  const cleanup = async () => {
    await host.close();
    fs.rmSync(folder, { recursive: true, force: true });
  };
  return { testersFile, host, base, games, logs, open, until, cleanup };
}

test('host: serves only the client page, nothing else', async () => {
  const fixture = await hostFixture();
  try {
    const page = await fetch(`${fixture.base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy') ?? '', /default-src 'none'/);
    assert.match(await page.text(), /client\.js/);
    const script = await fetch(`${fixture.base}/client.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /WebSocket/);
    assert.equal((await fetch(`${fixture.base}/client.css`)).status, 200);
    for (const pathname of ['/host.js', '/../host.js', '/client/../host.js', '/%2e%2e/main.js', '/index.html', '/ws', '/desktop/main.js', '/client.ts']) {
      assert.equal((await fetch(`${fixture.base}${pathname}`)).status, 404, pathname);
    }
    assert.equal((await fetch(`${fixture.base}/`, { method: 'POST' })).status, 404);
  } finally { await fixture.cleanup(); }
});

test('host: a bad link is refused; a good one gets a game, frames out, input in, paste dropped', async () => {
  const fixture = await hostFixture();
  try {
    const bad = await fixture.open('nope');
    await fixture.until(() => bad.got.closed);
    assert.equal(bad.got.closed, CLOSE.badToken);
    assert.match(bad.got.json[0]?.message ?? '', /not valid/);
    assert.equal(fixture.games.length, 0);

    const { token } = addTester(fixture.testersFile, 'bob');
    const client = await fixture.open(token);
    await fixture.until(() => client.got.json.length);
    assert.deepEqual(client.got.json[0], { t: 'ready', name: 'bob', width: 960, height: 540 });
    const game = fixture.games[0]!;
    assert.equal(game.focused, 1);
    assert.equal(game.refreshed, 1);
    assert.equal(game.paint(), 1);
    await fixture.until(() => client.got.binary.length);
    assert.deepEqual([...client.got.binary[0]!], [0xff, 0xd8, 0xff]);

    client.socket.send(JSON.stringify({ t: 'kd', code: 'KeyD', key: 'd', m: 0 }));
    client.socket.send(JSON.stringify({ t: 'kd', code: 'KeyV', key: 'v', m: 2 }));
    client.socket.send(JSON.stringify({ t: 'mm', x: 5, y: 6 }));
    await fixture.until(() => game.inputs.some((event) => event.type === 'mouseMove'));
    assert.deepEqual(game.inputs.map((event) => event.type), ['keyDown', 'char', 'mouseMove']);

    client.socket.close();
    await fixture.until(() => game.inputs.some((event) => event.type === 'keyUp'));
    assert.deepEqual(game.inputs.at(-1), { type: 'keyUp', keyCode: 'D', modifiers: [] }, 'released on leave');
    assert.equal(game.paint(), 0, 'no one to send frames to');
    assert.equal(game.destroyed, false, 'kept for a reconnect');
  } finally { await fixture.cleanup(); }
});

test('host: a reconnect continues the same game; a second tab takes it over', async () => {
  const fixture = await hostFixture();
  try {
    const { token } = addTester(fixture.testersFile, 'cat');
    const first = await fixture.open(token);
    await fixture.until(() => first.got.json.length);
    const second = await fixture.open(token);
    await fixture.until(() => second.got.json.length && first.got.closed);
    assert.equal(first.got.closed, CLOSE.replaced);
    assert.match(first.got.json.at(-1)?.message ?? '', /opened somewhere else/);
    assert.equal(fixture.games.length, 1);
    assert.equal(fixture.games[0]!.paint(), 1);
  } finally { await fixture.cleanup(); }
});

test('host: connecting while the game starts waits for it (a reload, a second tab); the newest wins', async () => {
  const fixture = await hostFixture({ startMs: 300 });
  try {
    const { token } = addTester(fixture.testersFile, 'eve');
    const first = await fixture.open(token);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await fixture.open(token);
    await fixture.until(() => second.got.json.some((message) => message.t === 'ready') && first.got.closed);
    assert.equal(fixture.games.length, 1);
    assert.equal(first.got.closed, CLOSE.replaced);
    assert.equal(fixture.games[0]!.paint(), 1);
    await fixture.until(() => second.got.binary.length);
  } finally { await fixture.cleanup(); }
});

test('host: full means full; an idle game is closed; a crashed game tells the tester', async () => {
  const fixture = await hostFixture({ maxGames: 1, idleMs: 50 });
  try {
    const one = addTester(fixture.testersFile, 'one').token;
    const two = addTester(fixture.testersFile, 'two').token;
    const first = await fixture.open(one);
    await fixture.until(() => first.got.json.length);
    const refused = await fixture.open(two);
    await fixture.until(() => refused.got.closed);
    assert.equal(refused.got.closed, CLOSE.full);
    first.socket.close();
    await fixture.until(() => fixture.games[0]!.destroyed);
    const second = await fixture.open(two);
    await fixture.until(() => second.got.json.length);
    fixture.games[1]!.crash();
    await fixture.until(() => second.got.closed);
    assert.equal(second.got.closed, CLOSE.gone);
    assert.match(second.got.json.at(-1)?.message ?? '', /stopped/);
  } finally { await fixture.cleanup(); }
});

test('host: an oversized or broken message drops that connection, never the host (no uncaught error)', async () => {
  const fixture = await hostFixture();
  try {
    const anonymous = new WebSocket(fixture.base.replace('http', 'ws') + '/ws');
    const anonymousClosed = new Promise((resolve) => anonymous.on('close', (code) => { resolve(code); }));
    await new Promise((resolve) => anonymous.on('open', resolve));
    anonymous.send('x'.repeat(10000));
    assert.equal(await anonymousClosed, 1009);
    const { token } = addTester(fixture.testersFile, 'big');
    const client = await fixture.open(token);
    await fixture.until(() => client.got.json.length);
    client.socket.send('x'.repeat(10000));
    await fixture.until(() => client.got.closed);
    assert.equal(client.got.closed, 1009);
    await new Promise<void>((resolve) => {
      const raw = net.connect(Number(new URL(fixture.base).port), '127.0.0.1', () => {
        raw.write('GET /ws HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n');
        setTimeout(() => {
          raw.write(Buffer.from([0x8f, 0xff, 1, 2, 3]));
          setTimeout(() => { raw.destroy(); resolve(); }, 100);
        }, 100);
      });
      raw.on('error', () => { resolve(); });
    });
    assert.equal((await fetch(`${fixture.base}/`)).status, 200);
  } finally { await fixture.cleanup(); }
});

test('host: wrong links are limited per address and logged', async () => {
  const fixture = await hostFixture();
  try {
    const { token } = addTester(fixture.testersFile, 'dan');
    for (let attempt = 0; attempt < 10; attempt++) {
      const client = await fixture.open('wrong' + attempt);
      await fixture.until(() => client.got.closed);
      assert.match(client.got.json[0]?.message ?? '', /not valid/);
    }
    const blocked = await fixture.open(token);
    await fixture.until(() => blocked.got.closed);
    assert.match(blocked.got.json[0]?.message ?? '', /Too many wrong links/);
    assert.equal(fixture.games.length, 0);
    assert.equal(fixture.logs.filter((line) => /wrong link from/.test(line)).length, 2, 'the first one, and the limit');
  } finally { await fixture.cleanup(); }
});

test('host: no hello, or a wrong first message, is dropped', async () => {
  const fixture = await hostFixture();
  try {
    const socket = new WebSocket(fixture.base.replace('http', 'ws') + '/ws');
    const closed = new Promise((resolve) => socket.on('close', (code) => { resolve(code); }));
    await new Promise((resolve) => socket.on('open', resolve));
    socket.send(JSON.stringify({ t: 'kd', code: 'KeyA' }));
    assert.equal(await closed, CLOSE.protocol);
  } finally { await fixture.cleanup(); }
});
