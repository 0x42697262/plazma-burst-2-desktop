import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { CATALOG } from '#shared/features/catalog.ts';
import { visibleCatalog } from '#shared/editions/hidden.ts';
import type { Edition } from '#shared/editions/types.ts';
import { resolveFlags, reportLines } from '#kernel/flags/resolve.ts';
import { createDiagnosticsWrapper } from '#features/diagnostics/wrapper.ts';
import { pageBuildOptions } from './build.ts';
import { readEdition } from './edition-file.ts';

const base = { title: 'T', appId: 'a.b', capabilities: null, features: null };
const HIDDEN: Edition = { ...base, name: 'hidden', diagnostics: { hidden: true } };
const SHOWN: Edition = { ...base, name: 'shown' };

async function pageInputs(edition: Edition) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-hidden-'));
  try {
    const { metafile, outputFiles } = await esbuild.build({ ...pageBuildOptions(outDir, edition), metafile: true, write: false });
    return { inputs: Object.keys(metafile.inputs), text: outputFiles.filter((file) => !file.path.endsWith('.map')).map((file) => file.text).join('') };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

test('hidden: the console has no diagnostics command, and the page still captures', async () => {
  const hidden = await pageInputs(HIDDEN);
  assert.deepEqual(hidden.inputs.filter((input) => input.includes('src/features/diagnostics/capabilities/')), []);
  assert.ok(hidden.inputs.includes('src/features/diagnostics/page.ts'));
  assert.ok(!hidden.text.includes('diagnostics status'));
  const shown = await pageInputs(SHOWN);
  assert.ok(shown.inputs.includes('src/features/diagnostics/capabilities/show/command.ts'), 'shown is the default');
  assert.ok(shown.text.includes('diagnostics status'));
});

test('hidden: the feature lists leave it out, and only a hidden edition does', () => {
  const { states, capabilities } = resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [], mode: 'local', client: 'official' });
  const lines = (edition: Edition) => reportLines(visibleCatalog(CATALOG, edition), states, capabilities).join('\n');
  assert.doesNotMatch(lines(HIDDEN), /diagnostics/);
  assert.match(lines(SHOWN), /diagnostics\.capture/);
});

test('hidden: no log lines, and reports are still saved', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-hidden-'));
  const run = (edition: Edition) => {
    const lines: string[] = [];
    const say = (line: string) => { lines.push(line); };
    const before = process.listenerCount('uncaughtExceptionMonitor');
    const { service } = createDiagnosticsWrapper(
      { log: { info: say, warn: say, error: say }, isCapabilityOn: () => false, gameVersion: 'v1', isSadburst: false, repoRoot: folder, gameDir: folder, devKvFile: '', host: '' } as never,
      { client: 'official', appVersion: '1', flags: {} as never, capabilities: {}, urlFromEnvironment: null, fetch: async () => new Response(), onRendererGone: () => undefined },
      path.join(folder, `${edition.name}.json`),
      path.join(folder, 'none.json'),
      edition,
    );
    assert.equal(process.listenerCount('uncaughtExceptionMonitor'), before, 'capture off here, so no listener');
    service.capture('manual', { message: 'x' });
    return { lines, kept: service.reports().length };
  };
  try {
    assert.deepEqual(run(HIDDEN), { lines: [], kept: 1 });
    const shown = run(SHOWN);
    assert.equal(shown.lines.length, 1);
    assert.equal(shown.kept, 1);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test('the edition file: diagnostics settings are checked, and need the feature', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-hidden-'));
  const write = (name: string, extra: object) => fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify({ name, title: 'T', appId: 'a.b', features: ['dev_console', 'console_core'], ...extra }));
  try {
    write('nofeature', { diagnostics: { hidden: true } });
    assert.match(readEdition('nofeature', folder).problems.join(), /need the feature/);
    write('badfield', { features: ['diagnostics'], diagnostics: { send: ['password'] } });
    assert.throws(() => readEdition('badfield', folder));
    write('good', { features: ['diagnostics'], diagnostics: { hidden: true, send: ['kind'] } });
    assert.deepEqual(readEdition('good', folder).edition.diagnostics, { hidden: true, send: ['kind'] });
    assert.equal(readEdition('diagnostics').edition.diagnostics?.hidden, true, 'the repository\'s showcase edition is hidden');
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
