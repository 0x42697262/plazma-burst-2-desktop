import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootConsole } from '../../../test/fake-game.mjs';
import { buildConsole } from './build.ts';

const ONLY_CONSOLE_GLOBAL = ['pb2dev'];

test('the console bundle boots in the fake game, runs commands and adds no global besides pb2dev', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-console-bundle-'));
  try {
    const bundle = await buildConsole(path.join(outDir, 'index.js'));
    const game = await bootConsole({ entry: bundle });
    const addedGlobals = Object.keys(game.G).filter((name) => !game.globalsBeforeConsole.includes(name));
    assert.deepEqual(addedGlobals, ONLY_CONSOLE_GLOBAL);
    const helpLines = game.run('help');
    assert.ok(helpLines.length > 0);
    assert.equal(game.run('set speed 2').length > 0, true);
    const consoleApi = Reflect.get(game.G, 'pb2dev') as { kv: Record<string, unknown> };
    assert.equal(consoleApi.kv.speed, 2);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
