import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { screenshotRoute } from './entry/route.ts';
import { saveWindowShot, type CapturableWindow } from './adapters/window-capture.ts';

test('the route: POST only, a remote tester gets one shot every 2 s, a failure is a 500', async () => {
  let time = 10000;
  const broken = { webContents: { capturePage: async () => { throw new Error('capture failed'); } } } as unknown as CapturableWindow;
  const route = screenshotRoute({ save: async (window) => { if (window === broken) throw new Error('capture failed'); return 'data/screenshots/pb2-x.png'; }, now: () => time });
  const url = new URL('https://example.test/__dev/screenshot');
  const post = () => new Request(url, { method: 'POST' });
  assert.equal((await route.handle(new Request(url), url, {})).status, 404);
  assert.deepEqual(await (await route.handle(post(), url, { window: 'local' })).json(), { file: 'data/screenshots/pb2-x.png' });
  const tester = { remote: true, window: 'tester' };
  assert.equal((await route.handle(post(), url, tester)).status, 200);
  time += 1000;
  assert.equal((await route.handle(post(), url, tester)).status, 429);
  time += 1500;
  assert.equal((await route.handle(post(), url, tester)).status, 200);
  assert.equal((await route.handle(post(), url, { window: broken })).status, 500);
});

test('shots in the same second get their own files; no window is an error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-shots-'));
  try {
    const window = { webContents: { capturePage: async () => ({ toPNG: () => Buffer.from('png') }) } };
    const moment = new Date(2026, 10, 2, 3, 4, 5);
    assert.equal(await saveWindowShot(window, dir, path.dirname(dir), moment), `${path.basename(dir)}/pb2-2026-11-02_03-04-05.png`);
    assert.equal(await saveWindowShot(window, dir, path.dirname(dir), moment), `${path.basename(dir)}/pb2-2026-11-02_03-04-05-2.png`);
    await assert.rejects(saveWindowShot(null, dir, dir), /no game window/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
