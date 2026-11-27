import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBackupStore } from './adapters/backups.ts';
import { backupRoutes } from './entry/backup-routes.ts';

function setup(on = true) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-netsaves-'));
  const store = createBackupStore(path.join(dir, 'netsaves'));
  let now = Date.UTC(2026, 0, 2, 3, 4, 5);
  const [route] = backupRoutes({ store, clock: () => now++, isOn: () => on });
  const call = async (method: string, query = '', body?: unknown, extra: Record<string, unknown> = {}) => {
    const url = new URL(`https://www.plazmaburst2.com/__dev/netsavebackups${query}`);
    const response = await route?.handle(new Request(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), url, extra);
    return { status: response?.status, body: response?.status === 200 ? await response.json() : await response?.text() };
  };
  return { dir, store, call, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('backups are saved readable only by you, listed newest first, and the newest 10 kept', async () => {
  const { dir, call, cleanup } = setup();
  try {
    const first = await call('POST', '', { kind: 'local', login: 'player-one', reason: 'before restore', data: { volume: 1, first_uid: 'a.b.c.d' } });
    assert.equal(first.status, 200);
    const file = path.join(dir, 'netsaves', `${(first.body as { id: string }).id}.json`);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    await call('POST', '', { kind: 'online', login: 'player-one', reason: 'before upload', text: 'volume=2;x=3;' });
    const listed = await call('GET');
    assert.deepEqual((listed.body as { kind: string; values: number; reason: string }[]).map(({ kind, values, reason }) => ({ kind, values, reason })), [
      { kind: 'online', values: 2, reason: 'before upload' },
      { kind: 'local', values: 2, reason: 'before restore' },
    ]);
    const one = await call('GET', `?id=${(first.body as { id: string }).id}`);
    assert.deepEqual((one.body as { data: unknown }).data, { volume: 1, first_uid: 'a.b.c.d' });
    for (let index = 0; index < 12; index++) await call('POST', '', { kind: 'local', login: 'player-one', reason: 'many', data: { index } });
    assert.equal(((await call('GET')).body as unknown[]).length, 10);
  } finally { cleanup(); }
});

test('backups refuse a bad body, an unknown or unsafe id, a remote tester, and all of it when off', async () => {
  const { call, cleanup } = setup();
  try {
    assert.equal((await call('POST', '', { kind: 'local', login: 'a', reason: 'x', text: 'not data' })).status, 400);
    assert.equal((await call('POST', '', { kind: 'other', login: 'a', reason: 'x', data: {} })).status, 400);
    assert.equal((await call('GET', '?id=../../etc/passwd')).status, 404);
    assert.equal((await call('GET', '', undefined, { remote: true })).status, 403);
  } finally { cleanup(); }
  const off = setup(false);
  try {
    assert.equal((await off.call('GET')).status, 403);
  } finally { off.cleanup(); }
});
