import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFingerprintStore as createFingerprints } from './adapters/store.ts';
import { shapeOf } from './domain/shape.ts';

const T0 = new Date(2026, 10, 1, 5, 30, 12);
const source = (ip: string, token: string, extra = '') => `( v )=>{ try { let FP = class FP { static getBrowserFingerprint() { return '{}'; } };${extra}
  return [FP.getBrowserFingerprint(), v, "${ip}", '${token}', \`\${v}-x\`, 42]; } catch (e) { return String(e); } }`;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-fingerprint-'));
  let time = T0.getTime();
  const fps = createFingerprints({ dir, now: () => new Date(time) });
  return { dir, fps, later: (ms: number) => { time += ms; }, files: () => fs.readdirSync(dir).filter((file) => file.endsWith('.js')).sort(), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('a version is the code without its values: comments, spacing, strings and numbers do not count', () => {
  assert.equal(shapeOf(source('1.2.3.4', 'abc')), shapeOf(source('180.190.136.53', 's27zkf')));
  assert.equal(shapeOf('a = "x" + 1; // note\n  b(\'y\', 2.5) /* c */'), shapeOf('a="other"+99;b("z",0.1)'));
  assert.notEqual(shapeOf(source('1.2.3.4', 'abc')), shapeOf(source('1.2.3.4', 'abc', ' FP.extra = 1;')));
  assert.equal(shapeOf('$0Ме1А[x1]'), '$0Ме1А[x1]', 'digits inside names stay');
});

test('each version is saved once; a known one with new values rewrites its file; the latest is the one seen last', async () => {
  const context = setup();
  try {
    assert.equal(await context.fps.latest(), null);
    const first = await context.fps.save(source('1.2.3.4', 'abc'), 'sync');
    assert.equal(first.status, 'new');
    assert.match(first.file, /^2026-11-01_05-30-12_[0-9a-f]{12}\.js$/);
    assert.equal(fs.readFileSync(path.join(context.dir, first.file), 'utf8'), source('1.2.3.4', 'abc'), 'the source exactly as sent');

    context.later(1000);
    assert.equal((await context.fps.save(source('1.2.3.4', 'abc'), 'sync')).status, 'same');
    context.later(1000);
    const again = await context.fps.save(source('5.6.7.8', 'xyz'), 'sync');
    assert.deepEqual([again.status, again.id, again.file], ['updated', first.id, first.file]);
    assert.equal(fs.readFileSync(path.join(context.dir, first.file), 'utf8'), source('5.6.7.8', 'xyz'), 'the newest values');
    assert.deepEqual(context.files(), [first.file], 'still one file');

    context.later(60000);
    const second = await context.fps.save(source('5.6.7.8', 'xyz', ' FP.extra = 1;'), 'async');
    assert.equal(second.status, 'new');
    assert.notEqual(second.id, first.id);
    assert.deepEqual(context.files(), [first.file, second.file].sort());
    const latest = await context.fps.latest();
    assert.deepEqual([latest?.id, latest?.kind, latest?.seen, latest?.versions], [second.id, 'async', 1, 2]);
    assert.equal(latest?.code, source('5.6.7.8', 'xyz', ' FP.extra = 1;'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(context.dir, 'index.json'), 'utf8')).schemaVersion, 1, 'the index is versioned');

    context.later(1000);
    assert.equal((await context.fps.save(source('5.6.7.8', 'xyz'), 'sync')).status, 'same');
    assert.equal(context.files().length, 2);
    const list = await context.fps.list();
    assert.deepEqual(list.map((version) => [version.id, version.latest, version.seen]), [[first.id, true, 4], [second.id, false, 1]]);
    assert.equal(list[0]?.first, T0.toISOString());
  } finally { context.cleanup(); }
});

test('only a fingerprinter\'s source of a known kind is saved', async () => {
  const context = setup();
  try {
    await assert.rejects(context.fps.save('', 'sync'), /expected the fingerprinter's source/);
    await assert.rejects(context.fps.save('x', 'eval'), /kind: sync or async/);
    assert.deepEqual(fs.readdirSync(context.dir), []);
  } finally { context.cleanup(); }
});

test('an index.json from before versioning is read and migrated', async () => {
  const context = setup();
  try {
    fs.writeFileSync(path.join(context.dir, 'old.js'), source('1.2.3.4', 'abc'));
    fs.writeFileSync(path.join(context.dir, 'index.json'), JSON.stringify({ latest: 'abc123abc123', versions: { abc123abc123: { file: 'old.js', kind: 'sync', chars: 10, first: T0.toISOString(), last: T0.toISOString(), seen: 2 } } }));
    const latest = await context.fps.latest();
    assert.equal(latest?.file, 'old.js');
    assert.equal(latest?.seen, 2);
    assert.equal(JSON.parse(fs.readFileSync(path.join(context.dir, 'index.json'), 'utf8')).schemaVersion, 1);
  } finally { context.cleanup(); }
});
