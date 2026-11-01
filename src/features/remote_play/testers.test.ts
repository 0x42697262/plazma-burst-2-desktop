import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addTester, findTester, listTesters, removeTester } from './adapters/testers-file.ts';
import { runTestersCli } from './entry/testers-cli.ts';

function tempTesters() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-remote-'));
  return { file: path.join(folder, 'testers.json'), cleanup: () => { fs.rmSync(folder, { recursive: true, force: true }); } };
}

test('testers: add gives a token that finds them; a new add replaces the old token; remove ends it', () => {
  const temp = tempTesters();
  try {
    const first = addTester(temp.file, 'Alice');
    assert.equal(first.name, 'alice');
    assert.ok(first.token.length >= 32);
    assert.deepEqual(findTester(temp.file, first.token), { name: 'alice' });
    assert.equal(findTester(temp.file, first.token + 'x'), null);
    assert.equal(findTester(temp.file, ''), null);
    const second = addTester(temp.file, 'alice');
    assert.equal(findTester(temp.file, first.token), null);
    assert.deepEqual(findTester(temp.file, second.token), { name: 'alice' });
    assert.deepEqual(listTesters(temp.file).map((tester) => tester.name), ['alice']);
    assert.equal(removeTester(temp.file, 'alice'), true);
    assert.equal(findTester(temp.file, second.token), null);
    assert.throws(() => addTester(temp.file, '../evil'), /tester name/);
    assert.equal((fs.statSync(temp.file).mode & 0o777).toString(8), '600');
  } finally { temp.cleanup(); }
});

test('testers: an unversioned file keeps working and is written back versioned; a broken one counts as none', () => {
  const temp = tempTesters();
  try {
    fs.writeFileSync(temp.file, JSON.stringify({ testers: { bob: { token: 'old-token', added: '2025-10-30T12:00:00.000Z' } } }));
    assert.deepEqual(findTester(temp.file, 'old-token'), { name: 'bob' });
    assert.equal(JSON.parse(fs.readFileSync(temp.file, 'utf8')).schemaVersion, 1);
    assert.deepEqual(listTesters(temp.file), [{ name: 'bob', added: '2025-10-30T12:00:00.000Z' }]);
    fs.writeFileSync(temp.file, '{ broken');
    assert.equal(findTester(temp.file, 'old-token'), null);
    assert.deepEqual(listTesters(temp.file), []);
  } finally { temp.cleanup(); }
});

test('testers command: add prints the link, list shows them, remove ends them, anything else is the usage', () => {
  const temp = tempTesters();
  try {
    const lines: string[] = [];
    const errors: string[] = [];
    const output = { log: (line: string) => { lines.push(line); }, error: (line: string) => { errors.push(line); } };
    assert.equal(runTestersCli(['add', 'Dan'], temp.file, output), 0);
    assert.match(lines[0] ?? '', /^Tester "dan" added/);
    const token = /#t=(\S+)/.exec(lines[1] ?? '')?.[1] ?? '';
    assert.deepEqual(findTester(temp.file, token), { name: 'dan' });
    lines.length = 0;
    assert.equal(runTestersCli(['list'], temp.file, output), 0);
    assert.match(lines[0] ?? '', /^ {2}dan +added \d{4}-/);
    lines.length = 0;
    assert.equal(runTestersCli(['remove', 'dan'], temp.file, output), 0);
    assert.equal(runTestersCli(['remove', 'dan'], temp.file, output), 0);
    assert.deepEqual(lines, ['Tester "dan" removed; their link no longer works.', 'No tester "dan".']);
    assert.equal(runTestersCli(['nonsense'], temp.file, output), 1);
    assert.match(errors[0] ?? '', /^usage:/);
  } finally { temp.cleanup(); }
});
