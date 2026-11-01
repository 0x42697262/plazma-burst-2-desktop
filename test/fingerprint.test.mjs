// desktop/fingerprint.js on real files in a temp folder: "npm test".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { createFingerprints, shapeOf } = createRequire(import.meta.url)('../desktop/fingerprint.js');

const T0 = new Date(2026, 10, 1, 5, 30, 12);
// A fingerprinter as the server writes it, with what it puts in per session.
const source = (ip, token, extra = '') => `( v )=>{ try { let FP = class FP { static getBrowserFingerprint() { return '{}'; } };${extra}
  return [FP.getBrowserFingerprint(), v, "${ip}", '${token}', \`\${v}-x\`, 42]; } catch (e) { return String(e); } }`;

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-fingerprint-'));
  let t = T0.getTime();
  const fps = createFingerprints({ dir, now: () => new Date(t) });
  return { dir, fps, later: (ms) => { t += ms; }, files: () => fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort(), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('a version is the code without its values: comments, spacing, strings and numbers do not count', () => {
  assert.equal(shapeOf(source('1.2.3.4', 'abc')), shapeOf(source('180.190.136.53', 's27zkf')));
  assert.equal(shapeOf('a = "x" + 1; // note\n  b(\'y\', 2.5) /* c */'), shapeOf('a="other"+99;b("z",0.1)'));
  assert.notEqual(shapeOf(source('1.2.3.4', 'abc')), shapeOf(source('1.2.3.4', 'abc', ' FP.extra = 1;')));
  assert.equal(shapeOf('$0Ме1А[x1]'), '$0Ме1А[x1]', 'digits inside names stay');
});

test('each version is saved once; a known one with new values rewrites its file; the latest is the one seen last', async () => {
  const t = setup();
  try {
    assert.equal(await t.fps.latest(), null);
    const a = await t.fps.save(source('1.2.3.4', 'abc'), 'sync');
    assert.equal(a.status, 'new');
    assert.match(a.file, /^2026-11-01_05-30-12_[0-9a-f]{12}\.js$/);
    assert.equal(fs.readFileSync(path.join(t.dir, a.file), 'utf8'), source('1.2.3.4', 'abc'), 'the source exactly as sent');

    t.later(1000);
    assert.equal((await t.fps.save(source('1.2.3.4', 'abc'), 'sync')).status, 'same');
    t.later(1000);
    const again = await t.fps.save(source('5.6.7.8', 'xyz'), 'sync');
    assert.deepEqual([again.status, again.id, again.file], ['updated', a.id, a.file]);
    assert.equal(fs.readFileSync(path.join(t.dir, a.file), 'utf8'), source('5.6.7.8', 'xyz'), 'the newest values');
    assert.deepEqual(t.files(), [a.file], 'still one file');

    t.later(60000);
    const b = await t.fps.save(source('5.6.7.8', 'xyz', ' FP.extra = 1;'), 'async');
    assert.equal(b.status, 'new');
    assert.notEqual(b.id, a.id);
    assert.deepEqual(t.files(), [a.file, b.file].sort());
    const latest = await t.fps.latest();
    assert.deepEqual([latest.id, latest.kind, latest.seen, latest.versions], [b.id, 'async', 1, 2]);
    assert.equal(latest.code, source('5.6.7.8', 'xyz', ' FP.extra = 1;'));

    // The server goes back to the first version: no new file, it is the latest again.
    t.later(1000);
    assert.equal((await t.fps.save(source('5.6.7.8', 'xyz'), 'sync')).status, 'same');
    assert.equal(t.files().length, 2);
    const list = await t.fps.list();
    assert.deepEqual(list.map((v) => [v.id, v.latest, v.seen]), [[a.id, true, 4], [b.id, false, 1]]);
    assert.equal(list[0].first, T0.toISOString());
  } finally { t.cleanup(); }
});

test('only a fingerprinter\'s source of a known kind is saved', async () => {
  const t = setup();
  try {
    await assert.rejects(t.fps.save('', 'sync'), /expected the fingerprinter's source/);
    await assert.rejects(t.fps.save('x', 'eval'), /kind: sync or async/);
    assert.deepEqual(fs.readdirSync(t.dir), []);
  } finally { t.cleanup(); }
});
