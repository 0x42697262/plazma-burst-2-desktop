import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMapFiles } from './adapters/map-files.ts';
import { mapDownloadInterceptor, mapRoutes } from './entry/routes.ts';

const HOST = 'www.plazmaburst2.com';
const MAP = '<player x="1" y="2" /><door x="3" />';

function setup(settings: Record<string, unknown> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-maps-'));
  const dir = path.join(root, 'maps');
  const kvFile = path.join(root, 'kv.json');
  fs.writeFileSync(kvFile, JSON.stringify(settings));
  const logged: string[] = [];
  const files = createMapFiles({ dir, gameDir: root, kvFile, repoRoot: root, info: (message) => logged.push(message) });
  return { root, dir, kvFile, files, logged, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

const mapDownload = (id: string) => new Request(`https://${HOST}/pb2/server.php`, { method: 'POST', body: new URLSearchParams({ rq: 'cmap', cmap: id }) });

test('a downloaded map is saved once, one tag per line; save_maps off saves nothing; a local ID or a non-map is refused', async () => {
  const context = setup();
  try {
    assert.equal(await context.files.save('author-arena', MAP), 'saved');
    assert.equal(fs.readFileSync(path.join(context.dir, 'author-arena.xml'), 'utf8'), '<player x="1" y="2" />\n<door x="3" />\n');
    assert.equal(await context.files.save('author-arena', MAP), 'same');
    await assert.rejects(context.files.save('local-x', MAP), /no map ID/);
    await assert.rejects(context.files.save('x', '<not_published />'), /not map XML/);
    fs.writeFileSync(context.kvFile, JSON.stringify({ save_maps: false }));
    assert.equal(await context.files.save('other', MAP), 'off');
  } finally { context.cleanup(); }
});

test('the routes list local maps, save edited ones without overwriting by surprise, and read a saved map', async () => {
  const context = setup();
  try {
    const routes = Object.fromEntries(mapRoutes({ files: context.files }).map((route) => [route.name, route]));
    const url = (query: string) => new URL(`https://${HOST}/__dev/x?${query}`);
    const edited = await routes.saveedited?.handle(new Request(url('name=mine'), { method: 'POST', body: MAP }), url('name=mine'), {});
    assert.deepEqual(await edited?.json(), { file: 'maps/mine.xml', id: 'local-mine' });
    const again = await routes.saveedited?.handle(new Request(url('name=mine'), { method: 'POST', body: MAP }), url('name=mine'), {});
    assert.equal(again?.status, 409);
    const forced = await routes.saveedited?.handle(new Request(url('name=mine&overwrite=1'), { method: 'POST', body: MAP }), url('name=mine&overwrite=1'), {});
    assert.equal(forced?.status, 200);
    assert.equal((await routes.saveedited?.handle(new Request(url('name=../x'), { method: 'POST', body: MAP }), url('name=../x'), {}))?.status, 400);
    assert.deepEqual(await (await routes.maps?.handle(new Request(url('')), url(''), {}))?.json(), ['local-mine']);
    await context.files.save('author-arena', MAP);
    assert.match(await (await routes.mapfile?.handle(new Request(url('id=author-arena')), url('id=author-arena'), {}))?.text() ?? '', /<door/);
    assert.equal((await routes.mapfile?.handle(new Request(url('id=nope')), url('id=nope'), {}))?.status, 404);
  } finally { context.cleanup(); }
});

test('the map download: a local ID is served from disk; with fast_maps a saved map is not downloaded; otherwise it is downloaded and saved', async () => {
  const context = setup();
  try {
    fs.mkdirSync(context.dir, { recursive: true });
    fs.writeFileSync(path.join(context.dir, 'arena.xml'), '﻿' + MAP + '\n');
    const errors: string[] = [];
    const intercept = mapDownloadInterceptor({ files: context.files, host: HOST, info: () => undefined, error: (message) => errors.push(message) });
    let fetched = 0;
    const fetchContext = { fetch: async () => { fetched++; return new Response(MAP); } };
    const call = (request: Request) => intercept(request, new URL(request.url), fetchContext);
    assert.equal(await (await call(mapDownload('local-ARENA')))?.text(), MAP);
    assert.equal(await (await call(mapDownload('local-missing')))?.text(), '<not_published />');
    assert.match(errors[0] ?? '', /Local map not found: local-missing/);
    assert.equal(await (await call(mapDownload('author-x')))?.text(), MAP);
    assert.equal(fetched, 1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.ok(fs.existsSync(path.join(context.dir, 'author-x.xml')), 'saved after the download');
    fs.writeFileSync(context.kvFile, JSON.stringify({ fast_maps: true }));
    assert.match(await (await call(mapDownload('author-x')))?.text() ?? '', /<door/);
    assert.equal(fetched, 1, 'fast load: not downloaded again');
    const other = new Request(`https://${HOST}/pb2/server.php`, { method: 'POST', body: new URLSearchParams({ rq: 'login' }) });
    assert.equal(await call(other), null);
    assert.equal(await intercept(new Request('https://example.test/pb2/server.php', { method: 'POST' }), new URL('https://example.test/pb2/server.php'), {}), null);
  } finally { context.cleanup(); }
});
