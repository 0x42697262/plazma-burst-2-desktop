import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createKvFile, seedKvFile } from './kv-file.ts';

function setup(initial?: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-kv-'));
  const file = path.join(dir, 'dev-overrides.json');
  if (initial !== undefined) fs.writeFileSync(file, initial);
  const events: [string, unknown][] = [];
  const kv = createKvFile(file, {
    onChange: (saved) => { events.push(['change', saved]); },
    onError: (message) => { events.push(['error', message]); },
    watchDelayMs: 20,
  });
  const disk = () => fs.readFileSync(file, 'utf8');
  const cleanup = () => { fs.rmSync(dir, { recursive: true, force: true }); };
  return { file, kv, events, disk, cleanup };
}

test('the console\'s own reads and writes are not news', async () => {
  const fixture = setup('{"god": true}');
  try {
    assert.equal(await fixture.kv.read(), '{"god": true}');
    assert.equal(await fixture.kv.write({ god: false }), true);
    assert.equal(fixture.disk(), '{\n  "god": false\n}\n');
    await fixture.kv.check();
    assert.deepEqual(fixture.events, []);
  } finally { fixture.cleanup(); }
});

test('no file: read gives {}, and the first write makes it', async () => {
  const fixture = setup();
  try {
    assert.equal(await fixture.kv.read(), '{}');
    assert.equal(await fixture.kv.write({ speed: 2 }), true);
    assert.deepEqual(JSON.parse(fixture.disk()), { speed: 2 });
  } finally { fixture.cleanup(); }
});

test('your edit goes to the console, and a console write never replaces it', async () => {
  const fixture = setup('{}');
  try {
    await fixture.kv.read();
    fs.writeFileSync(fixture.file, '{"profiles": {"fun": {"speed": 3}}}');
    assert.equal(await fixture.kv.write({ history: ['heal'] }), false);
    assert.equal(fixture.disk(), '{"profiles": {"fun": {"speed": 3}}}', 'your edit is still there');
    assert.deepEqual(fixture.events, [['change', { profiles: { fun: { speed: 3 } } }]]);
    assert.equal(await fixture.kv.write({ profiles: { fun: { speed: 3 } }, history: ['heal'] }), true);
  } finally { fixture.cleanup(); }
});

test('a broken file is reported once and not written over until it is fixed', async () => {
  const fixture = setup('{"god": true}');
  try {
    await fixture.kv.read();
    fs.writeFileSync(fixture.file, '{"god": tru');
    await fixture.kv.check();
    await fixture.kv.check();
    assert.equal(fixture.events.length, 1);
    assert.equal(fixture.events[0]?.[0], 'error');
    assert.equal(await fixture.kv.write({ god: false }), false);
    assert.equal(fixture.disk(), '{"god": tru', 'your half-written edit stays');
    assert.equal(fixture.events.length, 1, 'still reported once');
    fs.writeFileSync(fixture.file, '[1, 2]');
    await fixture.kv.check();
    assert.deepEqual(fixture.events.at(-1), ['error', 'expected a JSON object']);
    fs.writeFileSync(fixture.file, '{"god": true, "speed": 2}');
    await fixture.kv.check();
    assert.deepEqual(fixture.events.at(-1), ['change', { god: true, speed: 2 }]);
    assert.equal(await fixture.kv.write({ god: false }), true);
  } finally { fixture.cleanup(); }
});

test('the folder watch sees a save, also one that replaces the file', async () => {
  const fixture = setup('{}');
  const stop = fixture.kv.watch();
  try {
    await fixture.kv.read();
    const tmp = `${fixture.file}.tmp`;
    fs.writeFileSync(tmp, '{"jump": 2}');
    fs.renameSync(tmp, fixture.file);
    for (let attempt = 0; attempt < 50 && !fixture.events.length; attempt++) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(fixture.events, [['change', { jump: 2 }]]);
  } finally {
    stop();
    fixture.cleanup();
  }
});

test('the app\'s default settings are written only when there is no settings file yet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-seed-'));
  try {
    const file = path.join(dir, 'data', 'dev-overrides.json');
    assert.equal(seedKvFile(file, {}), false, 'no defaults, no file');
    assert.equal(fs.existsSync(file), false);
    assert.equal(seedKvFile(file, { speed: 2, binds: { 'shift+f': 'tp' } }), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { speed: 2, binds: { 'shift+f': 'tp' } });
    fs.writeFileSync(file, '{}');
    assert.equal(seedKvFile(file, { speed: 3 }), false, 'an existing file is the player\'s');
    assert.equal(fs.readFileSync(file, 'utf8'), '{}');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
