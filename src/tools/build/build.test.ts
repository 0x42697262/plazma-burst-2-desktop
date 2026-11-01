import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import * as esbuild from 'esbuild';
import { buildPage, pageBuildOptions } from './build.ts';

const ONLY_CONSOLE_GLOBAL = ['pb2dev'];

test('the page core and console bundles boot in the fake game, run commands and add no global besides pb2dev', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-page-bundle-'));
  try {
    await buildPage(outDir);
    const game = await bootConsole({ pageEntry: path.join(outDir, 'page.js'), entry: path.join(outDir, 'console.js') });
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

test('the page core bundle holds no dev console code: no panel, commands or settings store', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-page-core-'));
  try {
    const { metafile } = await esbuild.build({ ...pageBuildOptions(outDir), metafile: true, write: false });
    const outputs = metafile.outputs;
    const pageOutput = Object.keys(outputs).find((name) => name.endsWith('/page.js')) ?? '';
    const loaded = new Set<string>();
    const visit = (name: string) => {
      if (loaded.has(name)) return;
      loaded.add(name);
      for (const imported of outputs[name]?.imports ?? []) if (imported.kind === 'import-statement') visit(imported.path);
    };
    visit(pageOutput);
    const sources = [...loaded].flatMap((name) => Object.keys(outputs[name]?.inputs ?? {}));
    assert.ok(sources.some((source) => source.startsWith('src/features/lobby_task_guard/')), 'the guard is in the page core');
    const consoleOnly = sources.filter((source) => /^src\/console\/(index|features)\.ts$|^src\/console\/kernel\/(ui|commands|state)\//.test(source));
    assert.deepEqual(consoleOnly, []);
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
