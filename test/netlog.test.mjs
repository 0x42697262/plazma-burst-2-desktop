// desktop/netlog.js on real files in a temp folder: "npm test".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { createNetLog } = createRequire(import.meta.url)('../desktop/netlog.js');

const T0 = new Date(2026, 10, 1, 5, 30, 12);

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-netlog-'));
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { dir, cleanup };
}

test('one file per run and instance, made on the first line, with a header that explains the columns', async () => {
  const t = setup();
  try {
    const nl = createNetLog({ dir: t.dir, version: 'v1', now: () => T0 });
    assert.deepEqual(fs.readdirSync(t.dir), [], 'nothing before the first line');
    assert.equal(nl.runName('local'), null);
    const run = await nl.append('local', ['05:30:13.000  c1 server     OUT  REL    #0 RELIABLE_HELLO  hi']);
    await nl.append('tester-ann', ['a']);
    await nl.append('local', ['second\nline']);
    assert.equal(run, '2026-11-01_05-30-12_local');
    assert.equal(nl.runName('local'), run);
    assert.deepEqual(fs.readdirSync(t.dir).sort(), ['2026-11-01_05-30-12_local.log', '2026-11-01_05-30-12_tester-ann.log']);
    const text = fs.readFileSync(path.join(t.dir, run + '.log'), 'utf8');
    assert.match(text, /^# Plazma Burst 2 network log\n/);
    assert.match(text, /instance "local", game v1/);
    assert.match(text, /LOSS {2}packet loss/);
    assert.match(text, /RELIABLE_HELLO {2}hi\nsecond line\n$/, 'a line break inside a line does not split it');
  } finally { t.cleanup(); }
});

test('two apps in the same second get their own files; list marks this app\'s and the active ones', async () => {
  const t = setup();
  try {
    const a = createNetLog({ dir: t.dir, now: () => T0 });
    const b = createNetLog({ dir: t.dir, now: () => T0 });
    assert.equal(await a.append('local', ['from a']), '2026-11-01_05-30-12_local');
    assert.equal(await b.append('local', ['from b']), '2026-11-01_05-30-12_local-2');
    const old = path.join(t.dir, '2020-01-01_00-00-00_local.log');
    fs.writeFileSync(old, '# header\nold line\n');
    fs.utimesSync(old, new Date(2020, 0, 1), new Date(2020, 0, 1));
    const now = createNetLog({ dir: t.dir });
    const runs = await a.list();
    assert.deepEqual(runs.map((r) => [r.name, r.instance, r.mine]), [
      ['2026-11-01_05-30-12_local-2', 'local', false],
      ['2026-11-01_05-30-12_local', 'local', true],
      ['2020-01-01_00-00-00_local', 'local', false],
    ]);
    const live = await now.list();
    assert.deepEqual(live.map((r) => r.active), [true, true, false]);
  } finally { t.cleanup(); }
});

test('read gives the last lines without the header, and refuses names that are not runs', async () => {
  const t = setup();
  try {
    const nl = createNetLog({ dir: t.dir, now: () => T0 });
    const run = await nl.append('local', ['1', '2', '3', '4']);
    assert.deepEqual(await nl.read(run), ['1', '2', '3', '4']);
    assert.deepEqual(await nl.read(run, 2), ['3', '4']);
    await assert.rejects(nl.read('../secret'), (e) => e.status === 400);
    await assert.rejects(nl.read('nope'), (e) => e.status === 404);
    await assert.rejects(nl.append('local', 'not an array'), /array/);
  } finally { t.cleanup(); }
});
