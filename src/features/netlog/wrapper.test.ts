import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLogger } from '#kernel/log/logger.ts';
import { createDevRouter } from '#wrapper/http/router.ts';
import { createNetLogFiles, StatusError } from './adapters/log-files.ts';
import { netlogRoutes } from './entry/routes.ts';

const T0 = new Date(2026, 10, 1, 5, 30, 12);
const quiet = { error: () => undefined, warn: () => undefined, log: () => undefined };

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-netlog-'));
  return { dir, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('one file per run and instance, made on the first line, with a header that explains the columns', async () => {
  const context = setup();
  try {
    const files = createNetLogFiles({ dir: context.dir, version: 'v1', now: () => T0 });
    assert.deepEqual(fs.readdirSync(context.dir), [], 'nothing before the first line');
    assert.equal(files.runName('local'), null);
    const run = await files.append('local', ['05:30:13.000  c1 server     OUT  REL    #0 RELIABLE_HELLO  hi']);
    await files.append('tester-ann', ['a']);
    await files.append('local', ['second\nline']);
    assert.equal(run, '2026-11-01_05-30-12_local');
    assert.equal(files.runName('local'), run);
    assert.deepEqual(fs.readdirSync(context.dir).sort(), ['2026-11-01_05-30-12_local.log', '2026-11-01_05-30-12_tester-ann.log']);
    const text = fs.readFileSync(path.join(context.dir, run + '.log'), 'utf8');
    assert.match(text, /^# Plazma Burst 2 network log\n/);
    assert.match(text, /instance "local", game v1/);
    assert.match(text, /LOSS {2}packet loss/);
    assert.match(text, /Passwords .* are written as ‹redacted›/);
    assert.match(text, /RELIABLE_HELLO {2}hi\nsecond line\n$/, 'a line break inside a line does not split it');
  } finally { context.cleanup(); }
});

test('two apps in the same second get their own files; list marks this app\'s and the active ones', async () => {
  const context = setup();
  try {
    const first = createNetLogFiles({ dir: context.dir, now: () => T0 });
    const second = createNetLogFiles({ dir: context.dir, now: () => T0 });
    assert.equal(await first.append('local', ['from a']), '2026-11-01_05-30-12_local');
    assert.equal(await second.append('local', ['from b']), '2026-11-01_05-30-12_local-2');
    const old = path.join(context.dir, '2020-01-01_00-00-00_local.log');
    fs.writeFileSync(old, '# header\nold line\n');
    fs.utimesSync(old, new Date(2020, 0, 1), new Date(2020, 0, 1));
    const runs = await first.list();
    assert.deepEqual(runs.map((run) => [run.name, run.instance, run.mine]), [
      ['2026-11-01_05-30-12_local-2', 'local', false],
      ['2026-11-01_05-30-12_local', 'local', true],
      ['2020-01-01_00-00-00_local', 'local', false],
    ]);
    const live = await createNetLogFiles({ dir: context.dir }).list();
    assert.deepEqual(live.map((run) => run.active), [true, true, false]);
  } finally { context.cleanup(); }
});

test('read gives the last lines without the header, and refuses names that are not runs', async () => {
  const context = setup();
  try {
    const files = createNetLogFiles({ dir: context.dir, now: () => T0 });
    const run = await files.append('local', ['1', '2', '3', '4']);
    assert.deepEqual(await files.read(run), ['1', '2', '3', '4']);
    assert.deepEqual(await files.read(run, 2), ['3', '4']);
    await assert.rejects(files.read('../secret'), (error: Error) => error instanceof StatusError && error.status === 400);
    await assert.rejects(files.read('nope'), (error: Error) => error instanceof StatusError && error.status === 404);
    await assert.rejects(files.append('local', 'not an array'), /array/);
  } finally { context.cleanup(); }
});

test('the routes: append, list and read; a tester sees only their own file; broken bodies are refused', async () => {
  const context = setup();
  try {
    const files = createNetLogFiles({ dir: context.dir, now: () => T0 });
    const router = createDevRouter([{ id: 'netlog', routes: netlogRoutes({ files, repoRoot: path.dirname(context.dir), isSadburst: false, log: createLogger('error', quiet) }) }], () => true);
    const url = (route: string) => new URL(`https://example.test/__dev/${route}`);
    const post = (body: string) => new Request(url('netlog'), { method: 'POST', body });
    const call = async (route: string, request: Request, requestContext = {}) => router(route, request, new URL(request.url), requestContext);

    const written = await call('netlog', post(JSON.stringify(['line one'])));
    assert.deepEqual(await written?.json(), { run: '2026-11-01_05-30-12_local', file: `${path.basename(context.dir)}/2026-11-01_05-30-12_local.log` });
    await call('netlog', post(JSON.stringify(['tester line'])), { remote: true, name: 'ann' });
    assert.equal((await call('netlog', post('{ nope')))?.status, 400);
    assert.equal((await call('netlog', post('"not an array"')))?.status, 500);
    assert.equal((await call('netlog', new Request(url('netlog'))))?.status, 404, 'only POST appends');

    const mine = await (await call('netruns', new Request(url('netruns'))))?.json() as { name: string; current: boolean }[];
    assert.deepEqual(mine.map((run) => [run.name, run.current]), [['2026-11-01_05-30-12_tester-ann', false], ['2026-11-01_05-30-12_local', true]]);
    const theirs = await (await call('netruns', new Request(url('netruns')), { remote: true, name: 'ann' }))?.json() as { name: string }[];
    assert.deepEqual(theirs.map((run) => run.name), ['2026-11-01_05-30-12_tester-ann']);

    assert.equal(await (await call('netread', new Request(url('netread'))))?.text(), 'line one');
    assert.equal((await call('netread', new Request(url('netread?run=2026-11-01_05-30-12_local')), { remote: true, name: 'ann' }))?.status, 403);
    assert.equal((await call('netread', new Request(url('netread')), { remote: true, name: 'bob' }))?.status, 404);
    assert.equal((await call('netread', new Request(url('netread?run=../x'))))?.status, 400);
  } finally { context.cleanup(); }
});

test('with the netlog flag off, its routes are not served', async () => {
  const context = setup();
  try {
    const files = createNetLogFiles({ dir: context.dir, now: () => T0 });
    const router = createDevRouter([{ id: 'netlog', routes: netlogRoutes({ files, repoRoot: context.dir, isSadburst: false, log: createLogger('error', quiet) }) }], (id) => id !== 'netlog');
    const request = new Request('https://example.test/__dev/netlog', { method: 'POST', body: '["x"]' });
    assert.equal(await router('netlog', request, new URL(request.url), {}), null);
    assert.deepEqual(fs.readdirSync(context.dir), [], 'nothing written');
  } finally { context.cleanup(); }
});
