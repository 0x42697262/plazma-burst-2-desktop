import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CATALOG } from '#shared/features/catalog.ts';
import type { FeatureToggle, FlagOverrides } from '#shared/features/types.ts';
import { resolveFlags, explicitlySet, reportLines } from './resolve.ts';
import { featuresFileStore, splitKnownFeatures } from './features-file.ts';

const resolve = ({ file = {}, unknown = [], env = [], mode = 'local', client = 'official' }: {
  file?: FlagOverrides; unknown?: string[]; env?: FeatureToggle[]; mode?: 'local' | 'remote' | 'server'; client?: 'official' | 'sadburst';
} = {}) => resolveFlags({ catalog: CATALOG, fileOverrides: file, fileUnknownIds: unknown, envToggles: env, mode, client });

test('with nothing set, every flag is its default or ruled out by the mode, and nothing was set explicitly', () => {
  const { states, problems } = resolve();
  assert.deepEqual(problems, []);
  assert.equal(states.dev_console.on, true);
  assert.equal(states.lobby_task_guard.on, true);
  assert.equal(states.remote_play.source, 'constraint');
  assert.deepEqual(explicitlySet(CATALOG, states), {});
  assert.deepEqual(explicitlySet(CATALOG, resolve({ file: { hooks: false }, env: [{ id: 'dev_console', on: false }] }).states), { dev_console: 'off:env', hooks: 'off:file' });
});

test('the environment wins over features.json, which wins over the default', () => {
  const fromFile = resolve({ file: { hooks: false } });
  assert.deepEqual(fromFile.states.hooks, { on: false, source: 'file', reason: null });
  const fromEnv = resolve({ file: { hooks: false }, env: [{ id: 'hooks', on: true }] });
  assert.deepEqual(fromEnv.states.hooks, { on: true, source: 'env', reason: null });
});

test('turning the console off turns off every feature that needs it, and says why', () => {
  const { states, problems } = resolve({ env: [{ id: 'dev_console', on: false }] });
  assert.deepEqual(problems, []);
  assert.deepEqual(states.console_core, { on: false, source: 'constraint', reason: 'needs dev_console' });
  assert.equal(states.map_editor.on, false);
  assert.equal(states.hooks.on, true, 'hooks are not part of the console');
});

test('modes and clients rule features out', () => {
  assert.deepEqual(resolve({ mode: 'remote' }).states.js_eval, { on: false, source: 'constraint', reason: 'not available in remote mode' });
  assert.equal(resolve({ mode: 'remote' }).states.remote_play.on, true);
  assert.equal(resolve().states.remote_play.on, false);
  assert.deepEqual(resolve({ client: 'sadburst' }).states.hooks, { on: false, source: 'constraint', reason: 'not available for the sadburst client' });
  assert.equal(resolve({ mode: 'server' }).states.p2p_host.on, true);
});

test('unknown ids, turning off a locked feature and changing an unread flag are problems', () => {
  const { states, problems } = resolve({
    unknown: ['teleporter'],
    env: [{ id: 'nope', on: true }, { id: 'console_core', on: false }, { id: 'zoom', on: false }],
  });
  assert.equal(problems.length, 4);
  assert.match(problems[0] ?? '', /features\.json: no feature "teleporter"/);
  assert.match(problems[1] ?? '', /PB2_FEATURES: no feature "nope"/);
  assert.match(problems[2] ?? '', /"console_core" cannot be turned off/);
  assert.match(problems[3] ?? '', /"zoom" cannot be changed yet/);
  assert.equal(states.zoom.on, true);
});

test('the report lists every feature with its state, source and description', () => {
  const lines = reportLines(CATALOG, resolve({ env: [{ id: 'hooks', on: false }] }).states);
  assert.equal(lines.length, CATALOG.length + 1);
  assert.match(lines.find((line) => line.startsWith('hooks ')) ?? '', /^hooks\s+off\s+env\s+hooks\/\*\.js/);
});

test('features.json is versioned; ids the catalog does not know are kept apart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-features-'));
  try {
    const file = path.join(dir, 'features.json');
    fs.writeFileSync(file, JSON.stringify({ hooks: false, warp: true }));
    const store = featuresFileStore(file);
    const read = store.readSync();
    assert.equal(read?.migratedFrom, 0);
    assert.deepEqual(splitKnownFeatures(read?.value ?? null), { overrides: { hooks: false }, unknownIds: ['warp'] });
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).schemaVersion, 1);
    assert.deepEqual(splitKnownFeatures(null), { overrides: {}, unknownIds: [] });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
