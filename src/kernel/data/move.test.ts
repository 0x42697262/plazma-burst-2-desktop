import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { moveLegacyData } from './move.ts';

const withRoot = (files: Record<string, string>): string => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-data-'));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
};
const read = (root: string, file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (root: string, file: string) => fs.existsSync(path.join(root, file));

test('local data moves into data/ once, folders and all, and the emptied old folders go', () => {
  const root = withRoot({
    'desktop/dev/names.js': 'names', 'desktop/maps/arena.xml': '<map/>', 'desktop/servers.json': '{}',
    'desktop/credentials.json': 'secret', 'desktop/credentials.json.alt': 'other', 'desktop/dev-overrides.json': '{"god":true}',
    'desktop/dev-overrides.json.bak': 'old', 'netlogs/run.log': 'log', 'features.json': '{}',
    'server/server.json': '{"port":1}', 'server/data/bans.json': '[]', 'server/data/cert.pem': 'cert', 'hooks/mine.js': 'hook',
    'data/server/server.example.json': 'tracked',
  });
  const report = moveLegacyData(root);
  assert.deepEqual(report.problems, []);
  assert.equal(report.moved.length, 12);
  assert.equal(read(root, 'data/names.js'), 'names');
  assert.equal(read(root, 'data/maps/arena.xml'), '<map/>');
  assert.equal(read(root, 'data/credentials.json'), 'secret');
  assert.equal(read(root, 'data/credentials.json.alt'), 'other', 'other credential files go along');
  assert.equal(read(root, 'data/dev-overrides.json.bak'), 'old');
  assert.equal(read(root, 'data/netlogs/run.log'), 'log');
  assert.equal(read(root, 'data/features.json'), '{}');
  assert.equal(read(root, 'data/server/server.json'), '{"port":1}');
  assert.equal(read(root, 'data/server/bans.json'), '[]', 'what was in the server\'s data folder goes to data/server, beside the tracked example');
  assert.equal(read(root, 'data/server/cert.pem'), 'cert');
  assert.equal(exists(root, 'desktop'), false, 'the emptied desktop/ is removed');
  assert.equal(exists(root, 'server'), false);
  assert.equal(read(root, 'hooks/mine.js'), 'hook', 'hooks stay where they are');
  assert.deepEqual(moveLegacyData(root), { moved: [], problems: [] }, 'a second run has nothing to do');
});

test('when both the old and the new place exist, nothing is overwritten and it says so', () => {
  const root = withRoot({ 'desktop/servers.json': 'old', 'data/servers.json': 'new', 'desktop/notes.txt': 'mine' });
  const report = moveLegacyData(root);
  assert.equal(report.moved.length, 0);
  assert.match(report.problems[0] ?? '', /^Both desktop\/servers\.json and data\/servers\.json exist: data\/servers\.json is used/);
  assert.equal(read(root, 'data/servers.json'), 'new');
  assert.equal(read(root, 'desktop/servers.json'), 'old');
  assert.equal(read(root, 'desktop/notes.txt'), 'mine', 'a folder that is not empty stays');
});
