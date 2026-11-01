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
