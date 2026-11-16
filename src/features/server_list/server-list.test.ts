import { IPC_CHANNEL, OPERATIONS } from './keys.ts';
import { serverListFor, serverListRoute } from './entry/route.ts';
import { registerServerListIpc } from './entry/ipc.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseAddress, normalFingerprint } from './domain/address.ts';
import { checkServer, passwordForSave, passwordSurvivesEdit, type ServerEntry } from './domain/server.ts';
import { parseStatusResponse } from './domain/status.ts';
import { createServersStore, type ServersStore } from './adapters/servers-file.ts';
import type { DefaultServer } from '#shared/editions/types.ts';
import { createServerListService, type GameSession, type ServerListDeps } from './services/server-list.ts';
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

function serviceWith(store: ServersStore, defaultServers: readonly DefaultServer[] = [], client?: ServerListDeps['client']) {
  const events: string[] = [];
  const session: GameSession = {
    clients: () => [{ id: 'official', title: 'Plazma Burst 2' }, { id: 'sadburst', title: 'Sad Burst 2' }, { id: 'sadburst_erich5', title: 'Sad Burst 2 (official servers)' }],
    prepare: async (id: string) => { events.push(`prepare ${id}`); },
    open: (id: string, title: string) => { events.push(`open ${id} ${title}`); },
    startLoggedOut: async () => { events.push('logged out'); },
    applyCredentials: async () => { events.push('credentials'); },
    showList: () => events.push('list'),
  };
  const probe: ServerProbe = {
    ping: async () => 12,
    fingerprint: async () => FP,
    status: async () => ({ name: 'There', players: 1 }),
  };
  const warnings: string[] = [];
  const service = createServerListService({
    store, probe, session, gameVersion: 'v1', newId, readOldJoin: () => null, defaultServers, client,
    info: (message) => events.push(message), warn: (message) => warnings.push(message), later: (action) => action(), relativeServersFile: 'data/servers.json',
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
    assert.deepEqual(events.filter((event) => !event.startsWith('Private')), ['prepare official', 'logged out', 'open official Plazma Burst 2 (Home)']);
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

test('the app\'s default servers are written once, when there is no list yet; they need a nickname before playing', async () => {
  const context = tempStore();
  try {
    const defaults = [{ name: 'Pal base', address: '18.231.112.9:2053', fingerprint: FP }];
    const { service, events } = serviceWith(context.store, defaults);
    service.createFirstList();
    const [seeded] = context.store.load().servers;
    assert.equal(seeded?.address, '18.231.112.9:2053');
    assert.equal(seeded?.nickname, '');
    assert.ok(events.includes('Added 1 server from this app\'s defaults to data/servers.json'), events.join('\n'));
    await assert.rejects(service.operations.play(seeded?.id), /needs a nickname/);
    service.operations.remove(seeded?.id);
    service.createFirstList();
    assert.deepEqual(context.store.load().servers, [], 'a removed default stays removed');
    const renamed = service.operations.save({ id: seeded?.id, address: '18.231.112.9:2053', fingerprint: FP, nickname: '' });
    assert.ok('errors' in renamed, 'saving still needs a nickname');
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

test('the list offers every game client; a play or a check names the client, and an unknown one is an error', async () => {
  const context = tempStore();
  try {
    const { service, events } = serviceWith(context.store);
    const listed = service.operations.list();
    assert.deepEqual(listed.clients.map((choice) => choice.id), ['official', 'sadburst', 'sadburst_erich5']);
    assert.equal(listed.client, 'official');
    assert.equal(service.operations.list('sadburst').client, 'sadburst');
    await service.operations.play('official', 'sadburst');
    assert.ok(events.includes('prepare sadburst') && events.includes('open sadburst Sad Burst 2'));
    assert.deepEqual(await service.operations.check('official', 'sadburst'), { ping: 12 });
    assert.throws(() => service.operations.list('flash'), /no game client "flash" in this app/);
    await assert.rejects(service.operations.play('official', 'flash'), /no game client "flash" in this app/);
  } finally { context.cleanup(); }
});

test('a client that cannot be prepared is not played: nothing is logged out and nothing opens', async () => {
  const context = tempStore();
  try {
    const events: string[] = [];
    const session: GameSession = {
      clients: () => [{ id: 'official', title: 'Plazma Burst 2' }],
      prepare: async () => { throw new Error('its game files are not ready'); },
      open: () => { events.push('open'); },
      startLoggedOut: async () => { events.push('logged out'); },
      applyCredentials: async () => { events.push('credentials'); },
      showList: () => undefined,
    };
    const service = createServerListService({ store: context.store, probe: {} as ServerProbe, session, gameVersion: 'v1', newId, readOldJoin: () => null, defaultServers: [], info: () => undefined, warn: () => undefined, later: (action) => action(), relativeServersFile: 'x' });
    await assert.rejects(service.operations.play('official'), /not ready/);
    assert.deepEqual(events, []);
  } finally { context.cleanup(); }
});

test('the account operations reach the port, are not on the page\'s route, and say so when there is none', async () => {
  const calls: unknown[][] = [];
  const accounts = {
    list: (client: unknown) => { calls.push(['list', client]); return { accounts: [] }; },
    use: (client: unknown, login: string) => { calls.push(['use', client, login]); },
    remove: async (client: unknown, login: string) => { calls.push(['remove', client, login]); },
    logIn: async (client: unknown, typed: unknown) => { calls.push(['logIn', client, typed]); return 'me'; },
  };
  const base: any = { store: { load: () => ({ servers: [], last: null, problems: [] }), save() {}, exists: () => true }, probe: {}, gameVersion: null, newId: () => 'id', readOldJoin: () => null, defaultServers: [], info() {}, warn() {}, later() {}, relativeServersFile: 'x' };
  const { accountOperations } = createServerListService({ ...base, session: { accounts, clients: () => [] } });
  assert.deepEqual(accountOperations.accountsOf('official'), { accounts: [] });
  accountOperations.useAccount({ client: 'official', login: 'me' });
  await accountOperations.removeAccount({ client: 'sadburst', login: 'me' });
  assert.equal(await accountOperations.logIn({ client: 'sadburst', login: 'me', password: 'pw' }), 'me');
  assert.deepEqual(calls.at(-1), ['logIn', 'sadburst', { login: 'me', password: 'pw' }]);
  const none = createServerListService({ ...base, session: { clients: () => [] } }).accountOperations;
  assert.equal(none.accountsOf('official'), null, 'no panel');
  assert.throws(() => none.useAccount({ client: 'official', login: 'me' }), /not in this app/);
  for (const operation of ['accounts', 'useAccount', 'removeAccount', 'logIn']) assert.ok(!OPERATIONS.includes(operation));
});

test('the first row is the running client\'s own servers, and playing it titles the window with that client', async () => {
  const context = tempStore();
  try {
    const sadburst = serviceWith(context.store, [], 'sadburst').service;
    const own = sadburst.operations.list().official;
    assert.deepEqual([own.id, own.name, own.host, own.client], ['official', 'Sad Burst 2', 'ca.sadburst2.com', 'sadburst']);
    const erich5 = serviceWith(context.store, [], 'sadburst_erich5');
    const official = erich5.service.operations.list().official;
    assert.deepEqual([official.name, official.host, official.client], ['PlazmaBurst2.com', 'vvvv.plazmaburst2.com', 'sadburst_erich5']);
    await erich5.service.operations.play('official');
    assert.ok(erich5.events.includes('open sadburst_erich5 Sad Burst 2 (official servers)'));
    assert.ok(erich5.events.includes('credentials'));
    assert.equal(serviceWith(context.store).service.operations.list().official.client, 'official');
  } finally { context.cleanup(); }
});

test('the list opens on the last client played; until one is played it is settled only when a client was asked for at start', async () => {
  const context = tempStore();
  try {
    const fresh = serviceWith(context.store).service;
    assert.deepEqual([fresh.operations.list().client, fresh.operations.list().isClientSettled], ['official', false], 'no client asked for: the launcher may use your last choice');
    await fresh.operations.play('official', 'sadburst');
    assert.deepEqual([fresh.operations.list().client, fresh.operations.list().isClientSettled], ['sadburst', true], 'back from Sad Burst 2: its list');
    assert.equal(fresh.operations.list('sadburst_erich5').client, 'sadburst_erich5', 'looking at another client does not change the default');
    assert.equal(fresh.operations.list().client, 'sadburst');
    const started = serviceWith(context.store, [], 'sadburst_erich5').service;
    assert.deepEqual([started.operations.list().client, started.operations.list().isClientSettled], ['sadburst_erich5', true]);
  } finally { context.cleanup(); }
});

test('the route a game page uses is bound to that page\'s client: the page cannot choose another one', async () => {
  const context = tempStore();
  try {
    const { service, events } = serviceWith(context.store);
    const route = serverListRoute(serverListFor(service, 'sadburst'));
    const post = (body: unknown) => new Request('https://sadburst2.com/gameplay/__dev/servers', { method: 'POST', body: JSON.stringify(body) });
    const url = new URL('https://sadburst2.com/gameplay/__dev/servers');
    const listed = await (await route.handle(post({ op: 'list', arg: 'official' }), url, {})).json() as { value: { client: string } };
    assert.equal(listed.value.client, 'sadburst', 'the arg is not a client');
    await route.handle(post({ op: 'play', arg: 'official' }), url, {});
    assert.ok(events.includes('prepare sadburst'));
    assert.ok(!events.includes('prepare official'));
  } finally { context.cleanup(); }
});

test('the launcher IPC passes the client on, and answers only the launcher page', async () => {
  const context = tempStore();
  try {
    const { service, events } = serviceWith(context.store);
    const handlers = new Map<string, (event: { senderFrame?: { url: string } | null }, ...args: unknown[]) => unknown>();
    registerServerListIpc({ handle: (channel, listener) => { handlers.set(channel, listener); } }, 'file:///app/launcher/index.html', service);
    const launcher = { senderFrame: { url: 'file:///app/launcher/index.html#x' } };
    const listed = await handlers.get(IPC_CHANNEL.list)?.(launcher, 'sadburst_erich5') as { client: string };
    assert.equal(listed.client, 'sadburst_erich5');
    await handlers.get(IPC_CHANNEL.play)?.(launcher, 'official', 'sadburst');
    assert.ok(events.includes('prepare sadburst'));
    await assert.rejects(Promise.resolve(handlers.get(IPC_CHANNEL.list)?.({ senderFrame: { url: 'https://evil.test/' } }, 'official')), /not allowed|Not allowed/i);
  } finally { context.cleanup(); }
});
