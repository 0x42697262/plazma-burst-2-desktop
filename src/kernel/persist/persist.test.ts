import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { createVersionedFile, PersistError } from './versioned.ts';
import { createSerialQueue } from './serial.ts';

const schema = z.object({ servers: z.array(z.object({ name: z.string(), port: z.number() })) });
type Servers = z.infer<typeof schema>;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-persist-'));
  const file = path.join(dir, 'nested', 'servers.json');
  const store = createVersionedFile<Servers>({
    file,
    version: 2,
    schema,
    migrations: {
      0: (data) => ({ servers: (data.list as string[]).map((name) => ({ name })) }),
      1: (data) => ({ servers: (data.servers as { name: string }[]).map((server) => ({ ...server, port: 2053 })) }),
    },
  });
  const writeRaw = (value: unknown) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
  const readRaw = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  return { dir, file, store, writeRaw, readRaw, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('a missing file reads as null', async () => {
  const context = setup();
  try {
    assert.equal(await context.store.read(), null);
    assert.equal(context.store.readSync(), null);
  } finally { context.cleanup(); }
});

test('a file without a version is v0 and is migrated to the latest on read, then written back', async () => {
  const context = setup();
  try {
    context.writeRaw({ list: ['home'] });
    const read = await context.store.read();
    assert.deepEqual(read, { value: { servers: [{ name: 'home', port: 2053 }] }, migratedFrom: 0 });
    assert.deepEqual(context.readRaw(), { schemaVersion: 2, servers: [{ name: 'home', port: 2053 }] });
    assert.equal((await context.store.read())?.migratedFrom, null);
  } finally { context.cleanup(); }
});

test('the write is atomic: no temporary file is left, and the version leads the file', async () => {
  const context = setup();
  try {
    await context.store.write({ servers: [] });
    assert.deepEqual(fs.readdirSync(path.dirname(context.file)), ['servers.json']);
    assert.match(fs.readFileSync(context.file, 'utf8'), /^\{\n {2}"schemaVersion": 2,/);
    context.store.writeSync({ servers: [{ name: 'a', port: 1 }] });
    assert.deepEqual(context.store.readSync()?.value, { servers: [{ name: 'a', port: 1 }] });
  } finally { context.cleanup(); }
});

test('a newer version than the app knows is refused and left untouched', async () => {
  const context = setup();
  try {
    context.writeRaw({ schemaVersion: 3, servers: [] });
    await assert.rejects(context.store.read(), (error: Error) => error instanceof PersistError && /version 3.*up to version 2/.test(error.message));
    assert.deepEqual(context.readRaw(), { schemaVersion: 3, servers: [] });
  } finally { context.cleanup(); }
});

test('broken JSON, a non-object and a schema mismatch are clear errors', async () => {
  const context = setup();
  try {
    fs.mkdirSync(path.dirname(context.file), { recursive: true });
    fs.writeFileSync(context.file, '{ nope');
    assert.throws(() => context.store.readSync(), /not valid JSON/);
    context.writeRaw([1, 2]);
    assert.throws(() => context.store.readSync(), /must hold a JSON object/);
    context.writeRaw({ schemaVersion: 2, servers: [{ name: 1 }] });
    assert.throws(() => context.store.readSync(), /does not match its schema/);
  } finally { context.cleanup(); }
});

test('the serial queue runs tasks one at a time, in order, and a failure does not stop the next', async () => {
  const serial = createSerialQueue();
  const order: string[] = [];
  const slow = serial(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); order.push('slow'); return 1; });
  const failing = serial(async () => { order.push('failing'); throw new Error('boom'); });
  const fast = serial(async () => { order.push('fast'); return 3; });
  assert.equal(await slow, 1);
  await assert.rejects(failing, /boom/);
  assert.equal(await fast, 3);
  assert.deepEqual(order, ['slow', 'failing', 'fast']);
});
