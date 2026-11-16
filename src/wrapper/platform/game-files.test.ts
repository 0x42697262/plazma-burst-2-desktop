import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGameFiles } from './game-files.ts';

const QUIET = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined, on: () => false } as never;
const BASE = 'https://sadburst2.com/gameplay_erich5/';

function setup(files: Record<string, string> = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-game-files-'));
  for (const [file, content] of Object.entries(files)) fs.writeFileSync(path.join(root, file), content);
  const asked: string[] = [];
  const fetchFromSite = async (request: Request | string) => {
    const url = typeof request === 'string' ? request : request.url;
    asked.push(url);
    return new Response(`image for ${new URL(url).searchParams.get('image_id')}`, { headers: { 'Content-Type': 'image/png' } });
  };
  const files_ = createGameFiles({ root, log: QUIET, keepMissing: true });
  const serve = (relative: string) => { const url = new URL(relative, BASE); return files_.serveFile(decodeURIComponent(url.pathname.slice(new URL(BASE).pathname.length)), url, fetchFromSite); };
  return { root, asked, serve, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('a server script under the game folder always goes to the site, with its query, and is never kept', async () => {
  const context = setup({ 'mimage_cache.php': 'an old kept copy' });
  try {
    assert.equal(await (await context.serve('mimage_cache.php?image_id=1')).text(), 'image for 1');
    assert.equal(await (await context.serve('mimage_cache.php?image_id=2')).text(), 'image for 2');
    assert.deepEqual(context.asked, [`${BASE}mimage_cache.php?image_id=1`, `${BASE}mimage_cache.php?image_id=2`]);
    assert.equal(fs.readFileSync(path.join(context.root, 'mimage_cache.php'), 'utf8'), 'an old kept copy', 'nothing written');
    assert.ok(!fs.existsSync(path.join(context.root, 'kept.txt')));
  } finally { context.cleanup(); }
});

test('a missing static file is still fetched once and kept', async () => {
  const context = setup();
  try {
    assert.equal((await context.serve('flash_export/x.png')).status, 200);
    assert.ok(fs.existsSync(path.join(context.root, 'flash_export', 'x.png')));
    assert.match(fs.readFileSync(path.join(context.root, 'kept.txt'), 'utf8'), /flash_export\/x\.png/);
  } finally { context.cleanup(); }
});
