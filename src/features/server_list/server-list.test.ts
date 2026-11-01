import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseAddress, normalFingerprint } from './domain/address.ts';
import { checkServer, passwordForSave, passwordSurvivesEdit, type ServerEntry } from './domain/server.ts';
import { parseStatusResponse } from './domain/status.ts';
import { createServersStore, type ServersStore } from './adapters/servers-file.ts';
import { createServerListService, type GameSession } from './services/server-list.ts';
import { serverListRoute } from './entry/route.ts';
import type { ServerProbe } from './adapters/probe.ts';

const FP = Array.from({ length: 32 }, (_, index) => index.toString(16).padStart(2, '0').toUpperCase()).join(':');
const OTHER_FP = FP.replace(/^00/, 'FF');
let nextId = 0;
const newId = () => `id${String(++nextId).padStart(6, '0')}`;

test('server list entries: address, pinned fingerprint, nickname', () => {
  assert.deepEqual(parseAddress('203.0.113.5:2054'), { host: '203.0.113.5', port: 2054, hostPort: '203.0.113.5:2054' });
  assert.equal(parseAddress('my.host').port, 2053);
  assert.equal(parseAddress('[::1]:9').host, '::1');
  assert.throws(() => parseAddress('a b:1'));
  assert.throws(() => parseAddress('host:70000'), /out of range/);
  assert.equal(normalFingerprint(FP.toLowerCase().replace(/:/g, '')), FP);
  const ok = checkServer({ address: 'https://1.2.3.4:2053/', fingerprint: FP.toLowerCase(), nickname: ' Pal ', password: 'pw' }, newId);
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.server?.hostPort, '1.2.3.4:2053');
  assert.equal(ok.server?.name, '1.2.3.4:2053', 'no name: the address');
  assert.equal(ok.server?.nickname, 'Pal');
  assert.equal(checkServer({ address: '', fingerprint: 'abc', nickname: '' }, newId).errors.length, 3);
  assert.deepEqual(checkServer('nope', newId), { server: null, errors: ['not a server entry'] });
});

test('a saved password survives an edit only while the address and the certificate stay the same', () => {
  const saved = checkServer({ id: 'abcdef12', address: '1.2.3.4:2053', fingerprint: FP, nickname: 'Pal', password: 'secret' }, newId).server as ServerEntry;
  const same = { id: saved.id, address: '1.2.3.4', fingerprint: FP.toLowerCase(), nickname: 'Pal2' };
  assert.equal(passwordSurvivesEdit(saved, same), true, 'the same address written differently, a new nickname');
  assert.deepEqual(passwordForSave(saved, same), { password: 'secret', dropped: false });
  assert.deepEqual(passwordForSave(saved, { ...same, address: '6.6.6.6:2053' }), { password: '', dropped: true }, 'another address');
  assert.deepEqual(passwordForSave(saved, { ...same, fingerprint: OTHER_FP }), { password: '', dropped: true }, 'another certificate');
  assert.deepEqual(passwordForSave(saved, { ...same, address: '6.6.6.6', password: 'typed' }), { password: 'typed', dropped: false }, 'a password given with the edit is used');
  assert.deepEqual(passwordForSave(null, { address: '1.2.3.4' }), { password: '', dropped: false });
  assert.equal(passwordSurvivesEdit(saved, { address: 'not an address!' }), false);
});

test('a status answer is read, chunked or not; anything else is a clear error', () => {
  assert.deepEqual(parseStatusResponse('HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{"players":2}'), { players: 2 });
  assert.deepEqual(parseStatusResponse('HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nd\r\n{"players":3}\r\n0\r\n\r\n'), { players: 3 });
  assert.throws(() => parseStatusResponse('HTTP/1.1 404 Not Found\r\n\r\n'), /no status/);
  assert.throws(() => parseStatusResponse('HTTP/1.1 200 OK\r\n\r\nnope'), /not JSON/);
});

function tempStore(): { store: ServersStore; file: string; cleanup(): void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-servers-'));
  const file = path.join(dir, 'servers.json');
  return { store: createServersStore(file, newId, (target) => fs.existsSync(target)), file, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('servers.json is versioned, written for the owner only, and a broken entry is left out with a problem', () => {
  const context = tempStore();
  try {
    assert.deepEqual(context.store.load(), { servers: [], last: null, problems: [] });
    const server = checkServer({ address: '1.2.3.4', fingerprint: FP, nickname: 'Pal', password: 'pw' }, newId).server as ServerEntry;
    context.store.save([server], server.id);
    const saved = JSON.parse(fs.readFileSync(context.file, 'utf8')) as { schemaVersion: number; servers: Record<string, unknown>[]; last: string };
    assert.equal(saved.schemaVersion, 1);
    assert.deepEqual(Object.keys(saved.servers[0] ?? {}).sort(), ['address', 'fingerprint', 'id', 'name', 'nickname', 'password']);
    assert.equal(fs.statSync(context.file).mode & 0o777, 0o600);
    fs.writeFileSync(context.file, '﻿' + JSON.stringify({ servers: [...saved.servers, { address: 'x y' }], last: saved.last }));
    const back = context.store.load();
    assert.equal(back.servers.length, 1);
    assert.equal(back.last, server.id);
    assert.match(back.problems[0] ?? '', /^server 2: /);
    assert.equal((JSON.parse(fs.readFileSync(context.file, 'utf8')) as { schemaVersion: number }).schemaVersion, 1, 'the old file was migrated');
  } finally { context.cleanup(); }
});

function serviceWith(store: ServersStore) {
  const events: string[] = [];
  const session: GameSession = {
    startLoggedOut: async () => { events.push('logged out'); },
    applyCredentials: async () => { events.push('credentials'); },
    loadGame: () => events.push('game'),
    showList: () => events.push('list'),
    setTitle: (title) => events.push(`title ${title}`),
  };
  const probe: ServerProbe = {
    ping: async () => 12,
    fingerprint: async () => FP,
    status: async () => ({ name: 'There', players: 1 }),
  };
  const warnings: string[] = [];
  const service = createServerListService({
    store, probe, session, gameVersion: 'v1', newId, readOldJoin: () => null,
    info: (message) => events.push(message), warn: (message) => warnings.push(message), later: (action) => action(), relativeServersFile: 'desktop/servers.json',
  });
  return { service, events, warnings };
}

test('saving through the list: a changed address drops the saved password, so it cannot be sent anywhere new', () => {
  const context = tempStore();
  try {
    const { service, warnings } = serviceWith(context.store);
    const added = service.operations.save({ address: '1.2.3.4', fingerprint: FP, nickname: 'Pal', password: 'secret', name: 'Home' });
    assert.ok('server' in added && added.server.hasPassword);
    const id = 'server' in added ? added.server.id : '';
    const renamed = service.operations.save({ id, address: '1.2.3.4', fingerprint: FP, nickname: 'Pal', name: 'Home 2' });
    assert.ok('server' in renamed && renamed.server.hasPassword, 'same address and certificate: kept');
    const moved = service.operations.save({ id, address: '6.6.6.6', fingerprint: OTHER_FP, nickname: 'Pal', name: 'Home 2' });
    assert.ok('server' in moved && !moved.server.hasPassword, 'moved: dropped');
    assert.equal(context.store.load().servers[0]?.password, '');
    assert.match(warnings[0] ?? '', /saved password was dropped/);
    assert.deepEqual(service.operations.save({ id: 'missing1', address: '1.2.3.4', fingerprint: FP, nickname: 'Pal' }), { errors: ['that server is not saved'] });
  } finally { context.cleanup(); }
});

test('playing a private server logs out, sets the join target and loads the game; the official one uses the credentials', async () => {
  const context = tempStore();
  try {
    const { service, events } = serviceWith(context.store);
    const added = service.operations.save({ address: '1.2.3.4', fingerprint: FP, nickname: 'Pal', name: 'Home' });
    const id = 'server' in added ? added.server.id : '';
    await service.operations.play(id);
    assert.equal(service.joinTarget()?.hostPort, '1.2.3.4:2053');
    assert.deepEqual(events.filter((event) => !event.startsWith('Private')), ['logged out', 'title Plazma Burst 2 (Home)', 'game']);
    assert.equal(context.store.load().last, id);
    await service.operations.play('official');
    assert.equal(service.joinTarget(), null);
    await assert.rejects(service.operations.play('nope'), /not saved/);
    service.showList();
    assert.equal(events.at(-1), 'list');
    assert.deepEqual(await service.operations.check('official'), { ping: 12 });
    assert.deepEqual(await service.operations.check(id), { ping: 12, status: { name: 'There', players: 1 } });
  } finally { context.cleanup(); }
});

test('the servers route: only for the local window, POST { op, arg }, known operations only', async () => {
  const context = tempStore();
  try {
    const route = serverListRoute(serviceWith(context.store).service);
    const url = new URL('https://example.test/__dev/servers');
    const post = (body: string) => new Request(url, { method: 'POST', body });
    assert.equal((await route.handle(post('{"op":"list"}'), url, { remote: true })).status, 403);
    assert.equal((await route.handle(post('{"op":"list"}'), url, { server: true })).status, 403);
    assert.equal((await route.handle(new Request(url), url, {})).status, 405);
    assert.equal((await route.handle(post('{ nope'), url, {})).status, 400);
    assert.equal((await route.handle(post('{"op":"format"}'), url, {})).status, 400);
    const listed = await (await route.handle(post('{"op":"list"}'), url, {})).json() as { ok: boolean; value: { official: { id: string } } };
    assert.equal(listed.value.official.id, 'official');
    const failed = await (await route.handle(post('{"op":"play","arg":"nope"}'), url, {})).json() as { ok: boolean; error: string };
    assert.deepEqual(failed, { ok: false, error: 'that server is not saved' });
  } finally { context.cleanup(); }
});
