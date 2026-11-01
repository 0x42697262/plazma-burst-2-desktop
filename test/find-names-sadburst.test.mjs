// tools/find-names-sadburst.js on a tiny Sad Burst 2 copy in a temp folder: "npm test".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sb = require('../tools/find-names-sadburst.js');

function copy(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-sb-'));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

test('minified booleans are read as words, comparisons are left alone', () => {
  assert.equal(sb.unminify('a.b=!0,c=!1;if(x!=0&&y!==1)z=!d'), 'a.b=true,c=false;if(x!=0&&y!==1)z=!d');
});

test('a name is the official one when it is in the Sad Burst code; missing ones are said', () => {
  const dir = copy({
    'gamelogic/scripts-manifest.json': JSON.stringify({ v: 1, strings: { en: 'gamelogic/s.js' }, order: ['gamelogic/a.js'] }),
    'gamelogic/s.js': '{let e=globalThis;e.$sGod="god"}',
    'gamelogic/a.js': 'class $ММ{static init_class(){$ММ.connections=[]}};let q=$ММ.$НеAAO;',
    'pb2-version.json': '{"version":"sadburst-1"}',
  });
  try {
    const result = sb.findNames(dir, [{ label: 'official client', names: { net: '$ММ', netLog: '$НеAAO', chars: '$0Ме1А' } }]);
    assert.equal(result.found.net, '$ММ');
    assert.equal(result.found.netLog, '$НеAAO');
    assert.equal(result.info.net.file, 'same as the official client');
    assert.ok(result.missing.includes('chars'), 'not in this code: not found');
    // No official names at all: says how to get them.
    assert.match(sb.findNames(dir, []).problems.join('\n'), /run "npm run fetch-game"/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('fetch-game --sadburst finds the page script\'s modules and the game\'s scripts', () => {
  const { htmlRefs, moduleRefs, manifestFiles } = require('../tools/fetch-sadburst.js');
  assert.deepEqual(htmlRefs('<link href="logo.png"><script src="./assets/index-X.js"></script><img src="/static/a.png"><a href="https://x/">'),
    ['logo.png', './assets/index-X.js']);
  assert.deepEqual(moduleRefs('m.f=["./a-1.js","./b-2.css"];import(`./c-3.js`);fetch("other.js")'), ['a-1.js', 'b-2.css', 'c-3.js']);
  assert.deepEqual(manifestFiles({ strings: { en: 'gamelogic/s.js', zh: 'gamelogic/z.js' }, order: ['gamelogic/a.js', 'gamelogic/s.js'] }),
    ['gamelogic/s.js', 'gamelogic/z.js', 'gamelogic/a.js']);
  assert.throws(() => manifestFiles({ order: [] }), /scripts manifest/);
});

test('fetch-game --sadburst knows what the game loads: its lists, its sprite loader, paths in its code, kept.txt', () => {
  const { assetPaths } = require('../tools/fetch-sadburst.js');
  const strings = new Map([['$o', 'images/asphalt.png'], ['$s', 'flash_export/sky']]);
  const paths = assetPaths({
    texts: [
      ['gamelogic/a.js', 'a("flash_export/guns",4,!0),e($s,3);sound_ogg_override.add("am_wind");x(`loading_screen.css`);y("https://cdn/x.png")'],
      ['assets/b.css', '.a{background:url(loading_screen/glow.png)}'],
      ['flash_export/just_sounds_and_bitmaps.html', '[{src:$o, id:`asphalt`},{src:"sounds/body.mp3", id:`body`}]'],
      ['flash_export/flash_skins/manifest.json', '[151,152]'],
      ['gamelogic/campaign/manifest.json', '{"levels":["c0a"]}'],
    ],
    strings,
    languages: ['en', 'zh'],
    kept: ['bitmap_overrides/mmenu.jpg', ''],
  });
  for (const p of ['flash_export/guns.png', 'flash_export/guns.js', 'flash_export/sky/frame0001.jpg', 'flash_export/sky/frame0003.jpg',
    'audio_overrides/am_wind.ogg', 'loading_screen.css', 'loading_screen/glow.png', 'flash_export/images/asphalt.png',
    'flash_export/sounds/body.mp3', 'flash_export/flash_skins/152.png', 'gamelogic/campaign/en/c0a.xml', 'gamelogic/campaign/zh/c0a.xml',
    'bitmap_overrides/mmenu.jpg']) assert.ok(paths.includes(p), p);
  assert.ok(!paths.includes('flash_export/sky/frame0004.jpg'), 'as many frames as the loader says');
  assert.ok(!paths.some((p) => p.includes('cdn')), 'not other sites');
});
