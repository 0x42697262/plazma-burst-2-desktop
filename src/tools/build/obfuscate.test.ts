import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { buildPage } from './build.ts';
import { obfuscateOutputs } from './obfuscate.ts';

const ONLY_CONSOLE_GLOBAL = ['pb2dev'];

test('the obfuscated page core and console boot in the fake game, run commands and add no global besides pb2dev', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-obfuscated-page-'));
  try {
    await buildPage(outDir);
    const plainConsole = fs.readFileSync(path.join(outDir, 'console.js'), 'utf8');
    const obfuscated = await obfuscateOutputs([outDir], [outDir]);
    assert.ok(obfuscated.includes(path.join(outDir, 'page.js')));
    assert.ok(obfuscated.includes(path.join(outDir, 'console.js')));
    const files = fs.readdirSync(outDir, { recursive: true }).map(String);
    assert.deepEqual(files.filter((file) => file.endsWith('.map')), [], 'no source map is left');
    const obfuscatedConsole = fs.readFileSync(path.join(outDir, 'console.js'), 'utf8');
    assert.notEqual(obfuscatedConsole, plainConsole);
    assert.doesNotMatch(obfuscatedConsole, /sourceMappingURL/);

    const game = await bootConsole({ pageEntry: path.join(outDir, 'page.js'), entry: path.join(outDir, 'console.js') });
    const addedGlobals = Object.keys(game.G).filter((name) => !game.globalsBeforeConsole.includes(name));
    assert.deepEqual(addedGlobals, ONLY_CONSOLE_GLOBAL);
    assert.ok(game.run('help').length > 0);
    assert.equal(game.run('set speed 2').length > 0, true);
    const consoleApi = Reflect.get(game.G, 'pb2dev') as { kv: Record<string, unknown> };
    assert.equal(consoleApi.kv.speed, 2);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

test('an obfuscated single-file output loses the source map next to it', async () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-obfuscated-file-'));
  const file = path.join(outDir, 'main.cjs');
  try {
    fs.writeFileSync(file, 'module.exports.answer = () => 42;\n//# sourceMappingURL=main.cjs.map\n');
    fs.writeFileSync(`${file}.map`, '{}');
    assert.deepEqual(await obfuscateOutputs([file], []), [file]);
    assert.equal(fs.existsSync(`${file}.map`), false);
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /sourceMappingURL/);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
