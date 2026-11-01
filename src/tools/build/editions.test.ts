import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { CATALOG } from '#shared/features/catalog.ts';
import type { Edition } from '#shared/editions/types.ts';
import { pageBuildOptions } from './build.ts';
import { editionNames, oneOffEdition, readEdition } from './edition-file.ts';
import { onlyEditionFeatures } from './edition-plugin.ts';

const featureSideOrEntry = (id: string) => new RegExp(`^src/features/${id}/(console|page|wrapper)\\.ts$|^src/features/${id}/entry/`);
const CONSOLE_ONLY = /^src\/console\/(index|features)\.ts$|^src\/console\/kernel\/(ui|commands|state)\//;

async function buildInMemory(edition: Edition) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-edition-'));
  try {
    const { metafile } = await esbuild.build({ ...pageBuildOptions(outDir, edition), metafile: true, write: false });
    const outputs = Object.keys(metafile.outputs).map((file) => path.basename(file)).filter((file) => !file.endsWith('.map'));
    return { inputs: Object.keys(metafile.inputs), outputs };
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

async function assertHoldsOnly(edition: Edition) {
  const { inputs, outputs } = await buildInMemory(edition);
  const included = edition.features ?? CATALOG.map((definition) => definition.id);
  for (const { id } of CATALOG) {
    if (included.includes(id)) continue;
    assert.deepEqual(inputs.filter((input) => featureSideOrEntry(id).test(input)), [], `${edition.name}: ${id} is left out`);
  }
  const hasConsole = included.includes('dev_console');
  assert.equal(outputs.includes('console.js'), hasConsole, `${edition.name}: console.js only with dev_console`);
  if (!hasConsole) assert.deepEqual(inputs.filter((input) => CONSOLE_ONLY.test(input)), [], `${edition.name}: no console code`);
}

test('every edition file reads without problems, and its bundles hold only its features', async () => {
  const names = editionNames();
  assert.ok(names.includes('player') && names.includes('dev'), names.join(', '));
  for (const name of names) {
    const { edition, problems } = readEdition(name);
    assert.deepEqual(problems, [], name);
    await assertHoldsOnly(edition);
  }
});

test('the two extremes build: only the page core, and every feature', async () => {
  const smallest = oneOffEdition([]);
  assert.deepEqual(smallest.edition.features, []);
  await assertHoldsOnly(smallest.edition);
  await assertHoldsOnly(oneOffEdition(CATALOG.map((definition) => definition.id)).edition);
});

test('a feature list keeps only the edition\'s features, and says when a left-out one is still used', () => {
  const source = [
    "import { zoomConsole } from '#features/zoom/console.ts';",
    "import { traceConsole } from '#features/trace/console.ts';",
    'export const LIST = [',
    '  zoomConsole,',
    '  traceConsole,',
    '];',
  ].join('\n');
  assert.equal(onlyEditionFeatures(source, ['trace'], 'list.ts'), "import { traceConsole } from '#features/trace/console.ts';\nexport const LIST = [\n  traceConsole,\n];");
  assert.throws(() => onlyEditionFeatures(`${source}\nzoomConsole.start();`, ['trace'], 'list.ts'), /list\.ts: zoomConsole is left out of this edition but still used/);
});

test('an edition file must name itself and list known features', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-editions-'));
  try {
    fs.writeFileSync(path.join(folder, 'mine.json'), JSON.stringify({ name: 'other', title: 'Mine', appId: 'a.b', features: [] }));
    assert.throws(() => readEdition('mine', folder), /"name" is "other", but must be the file's name/);
    fs.writeFileSync(path.join(folder, 'mine.json'), JSON.stringify({ name: 'mine', title: 'Mine', appId: 'a.b', features: ['teleporter'] }));
    assert.deepEqual(readEdition('mine', folder).problems, ['no feature "teleporter" (see "npm start -- --features")']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
