import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { checkConfig } from '#server/config.ts';
import { pageBuildOptions } from './build.ts';
import { editionNames, serverEditionNames } from './edition-file.ts';
import { readServerEdition, serverBundleOptions, withPublicUrl, type ServerEdition } from './server-edition.ts';
import { releaseServerEdition } from '#tools/release/server-release.ts';

const EXAMPLE = {
  name: 'example',
  kind: 'server',
  title: 'Example Server',
  include_game: false,
  server: { features: ['web_client'] },
  web: { features: ['server_list', 'lobby_task_guard', 'cert_pinning'] },
  config: { name: 'Example', behind_proxy: true, public_url: 'https://pb2.example.test', map_sources: ['site'] },
};

function withEditionFolder(files: Record<string, unknown>, run: (folder: string) => Promise<void> | void) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-server-edition-'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(folder, `${name}.json`), JSON.stringify(content));
  return Promise.resolve(run(folder)).finally(() => fs.rmSync(folder, { recursive: true, force: true }));
}

async function inputsOf(options: esbuild.BuildOptions): Promise<string[]> {
  const { metafile } = await esbuild.build({ ...options, metafile: true, write: false });
  return Object.keys(metafile.inputs);
}

test('server editions: a kind of its own, left out of the app editions', () => withEditionFolder({ example: EXAMPLE, app: { name: 'app', title: 'App', appId: 'io.example.app', features: ['server_list', 'lobby_task_guard', 'cert_pinning'] } }, (folder) => {
  assert.deepEqual(editionNames(folder), ['app']);
  assert.deepEqual(serverEditionNames(folder), ['example']);
  const edition = readServerEdition('example', folder);
  assert.deepEqual(edition.problems, []);
  assert.deepEqual(edition.server.features, ['web_client']);
  assert.equal(edition.includeGame, false);
}));

test('server editions: the server part takes lobby features only, the web part never the console', () => withEditionFolder({
  example: { ...EXAMPLE, server: { features: ['teleport'] }, web: { features: ['dev_console', 'teleport'] }, config: { port: 'nope' } },
}, (folder) => {
  const { problems } = readServerEdition('example', folder);
  assert.ok(problems.some((problem) => /server: "teleport" is not a lobby server feature/.test(problem)), problems.join('\n'));
  assert.ok(problems.some((problem) => /web: "dev_console" has no place/.test(problem)), problems.join('\n'));
  assert.ok(problems.some((problem) => /config: port/.test(problem)), problems.join('\n'));
}));

test('server editions: each part holds only its features', () => withEditionFolder({ example: EXAMPLE }, async (folder) => {
  const edition = readServerEdition('example', folder);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-server-bundle-'));
  try {
    const serverInputs = await inputsOf(serverBundleOptions(path.join(out, 'server.cjs'), edition.server));
    assert.ok(serverInputs.some((input) => input.startsWith('src/features/web_client/')));
    assert.deepEqual(serverInputs.filter((input) => input.startsWith('src/features/map_bot/')), [], 'map_bot is left out');
    const webInputs = await inputsOf(pageBuildOptions(path.join(out, 'page'), edition.web));
    assert.deepEqual(webInputs.filter((input) => input.startsWith('src/console/index.ts') || input.startsWith('src/console/kernel/ui/')), [], 'no dev console in the web client');
    assert.ok(webInputs.some((input) => input.startsWith('src/features/lobby_task_guard/')));
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}));

test('server editions: a release is the bundle, its Docker and Caddy files, and an archive', () => withEditionFolder({ example: EXAMPLE }, async (folder) => {
  const edition: ServerEdition = readServerEdition('example', folder);
  const outRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-server-release-'));
  try {
    const { folder: bundle, archive } = await releaseServerEdition(edition, { outRoot, fetchGame: async () => { throw new Error('include_game is false'); } });
    for (const file of ['dist/server/server.cjs', 'dist/web/page/page.js', 'Dockerfile', 'compose.yml', 'Caddyfile', 'README.md', 'server.example.json']) {
      assert.ok(fs.existsSync(path.join(bundle, file)), file);
    }
    assert.deepEqual(fs.readdirSync(path.join(bundle, 'game')), [], 'no game unless include_game');
    assert.ok(!fs.readdirSync(path.join(bundle, 'dist/web/page'), { recursive: true }).some((file) => String(file).endsWith('.map')), 'no source maps');
    const caddyfile = fs.readFileSync(path.join(bundle, 'Caddyfile'), 'utf8');
    assert.match(caddyfile, /^pb2\.example\.test:443 \{/m);
    assert.match(caddyfile, /173\.245\.48\.0\/20/);
    assert.match(caddyfile, /^:2053 \{/m, 'a direct port for the desktop app, which pins the certificate');
    assert.match(fs.readFileSync(path.join(bundle, 'compose.yml'), 'utf8'), /"2053:2053"/);
    assert.doesNotMatch(fs.readFileSync(path.join(bundle, 'README.md'), 'utf8'), /\{\{/);
    assert.deepEqual(checkConfig(JSON.parse(fs.readFileSync(path.join(bundle, 'server.example.json'), 'utf8'))).errors, []);
    assert.ok(fs.statSync(archive).size > 0);
  } finally {
    fs.rmSync(outRoot, { recursive: true, force: true });
  }
}));

test('server editions: the address players open can come from the release command, not the file', () => withEditionFolder({ example: { ...EXAMPLE, config: { name: 'Example' } } }, (folder) => {
  const edition = readServerEdition('example', folder);
  assert.equal(withPublicUrl(edition, null), edition);
  assert.equal(withPublicUrl(edition, 'https://pb2.example.test').config.public_url, 'https://pb2.example.test');
  assert.ok(withPublicUrl(edition, 'not a url').problems.some((problem) => /public_url/.test(problem)));
}));
