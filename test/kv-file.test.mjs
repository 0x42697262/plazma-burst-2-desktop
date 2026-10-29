// desktop/kv-file.js on a real file in a temp folder: "npm test".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { createKvFile } = createRequire(import.meta.url)('../desktop/kv-file.js');

function setup(initial) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-kv-'));
  const file = path.join(dir, 'dev-overrides.json');
  if (initial !== undefined) fs.writeFileSync(file, initial);
  const events = [];
  const kv = createKvFile(file, {
    onChange: (obj) => events.push(['change', obj]),
    onError: (msg) => events.push(['error', msg]),
    watchDelayMs: 20,
  });
  const disk = () => fs.readFileSync(file, 'utf8');
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { file, kv, events, disk, cleanup };
}

test('the console\'s own reads and writes are not news', async () => {
  const t = setup('{"god": true}');
  try {
    assert.equal(await t.kv.read(), '{"god": true}');
    assert.equal(await t.kv.write({ god: false }), true);
    assert.equal(t.disk(), '{\n  "god": false\n}\n');
    await t.kv.check();
    assert.deepEqual(t.events, []);
  } finally { t.cleanup(); }
});

test('no file: read gives {}, and the first write makes it', async () => {
  const t = setup();
  try {
    assert.equal(await t.kv.read(), '{}');
    assert.equal(await t.kv.write({ speed: 2 }), true);
    assert.deepEqual(JSON.parse(t.disk()), { speed: 2 });
  } finally { t.cleanup(); }
});

test('your edit goes to the console, and a console write never replaces it', async () => {
  const t = setup('{}');
  try {
    await t.kv.read();
    fs.writeFileSync(t.file, '{"profiles": {"fun": {"speed": 3}}}');
    // The console saves (its history) before the watcher has run: refused, and the
    // console gets the file instead.
    assert.equal(await t.kv.write({ history: ['heal'] }), false);
    assert.equal(t.disk(), '{"profiles": {"fun": {"speed": 3}}}', 'your edit is still there');
    assert.deepEqual(t.events, [['change', { profiles: { fun: { speed: 3 } } }]]);
    // Now the console has seen it: its writes go through again.
    assert.equal(await t.kv.write({ profiles: { fun: { speed: 3 } }, history: ['heal'] }), true);
  } finally { t.cleanup(); }
});

test('a broken file is reported once and not written over until it is fixed', async () => {
  const t = setup('{"god": true}');
  try {
    await t.kv.read();
    fs.writeFileSync(t.file, '{"god": tru');
    await t.kv.check();
    await t.kv.check();
    assert.equal(t.events.length, 1);
    assert.equal(t.events[0][0], 'error');
    assert.equal(await t.kv.write({ god: false }), false);
    assert.equal(t.disk(), '{"god": tru', 'your half-written edit stays');
    assert.equal(t.events.length, 1, 'still reported once');
    fs.writeFileSync(t.file, '[1, 2]');
    await t.kv.check();
    assert.deepEqual(t.events.at(-1), ['error', 'expected a JSON object']);
    fs.writeFileSync(t.file, '{"god": true, "speed": 2}');
    await t.kv.check();
    assert.deepEqual(t.events.at(-1), ['change', { god: true, speed: 2 }]);
    assert.equal(await t.kv.write({ god: false }), true);
  } finally { t.cleanup(); }
});

test('the folder watch sees a save, also one that replaces the file', async () => {
  const t = setup('{}');
  const stop = t.kv.watch();
  try {
    await t.kv.read();
    const tmp = `${t.file}.tmp`;
    fs.writeFileSync(tmp, '{"jump": 2}');
    fs.renameSync(tmp, t.file); // how many editors save
    for (let i = 0; i < 50 && !t.events.length; i++) await new Promise((r) => setTimeout(r, 20));
    assert.deepEqual(t.events, [['change', { jump: 2 }]]);
  } finally { stop(); t.cleanup(); }
});
