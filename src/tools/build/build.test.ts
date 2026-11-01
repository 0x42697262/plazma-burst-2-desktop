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

test('the launcher builds into its own folder: page script, preload for Electron, and the page itself', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-launcher-'));
  try {
    const { buildLauncher } = await import('./build.ts');
    await buildLauncher(outDir);
    const files = fs.readdirSync(outDir).filter((name) => !name.endsWith('.map')).sort();
    assert.deepEqual(files, ['index.html', 'launcher.css', 'launcher.js', 'preload.cjs']);
    const preload = fs.readFileSync(path.join(outDir, 'preload.cjs'), 'utf8');
    assert.match(preload, /require\("electron"\)/);
    assert.match(preload, /servers:list/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
