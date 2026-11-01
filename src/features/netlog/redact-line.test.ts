import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactLoggedLine } from './domain/redact-line.ts';

const line = (message: string, tail = '') => `05:30:13.000  c1 server     OUT  REL    #0 ${message}${tail}`;

test('a written AUTHENTICATE, JOIN_MATCH or CREATE_MATCH line loses its password; nothing else changes', () => {
  assert.equal(redactLoggedLine(line('AUTHENTICATE("player", "0123456789abcdef", "version_h5", "x, y")')),
    line('AUTHENTICATE("player", "‹redacted›", "version_h5", "x, y")'));
  assert.equal(redactLoggedLine(line('AUTHENTICATE(".guest", "", "version_h5")')), line('AUTHENTICATE(".guest", "", "version_h5")'));
  assert.equal(redactLoggedLine(line('JOIN_MATCH("ab", 3, "de", "1", "matchpass")', '  <- answers #4 PING (x)')),
    line('JOIN_MATCH("ab", 3, "de", "1", "‹redacted›")', '  <- answers #4 PING (x)'));
  assert.equal(redactLoggedLine(line('CREATE_MATCH({"title":"a, b","password":"pw","rounds":[1,2]}, "r")')),
    line('CREATE_MATCH({"title":"a, b","password":"‹redacted›","rounds":[1,2]}, "r")'));
  assert.equal(redactLoggedLine(line('CHAT("my password is hunter2")')), line('CHAT("my password is hunter2")'));
  assert.equal(redactLoggedLine('# a header line'), '# a header line');
  assert.equal(redactLoggedLine(line('AUTHENTICATE("p", "already ‹redacted›")')), line('AUTHENTICATE("p", "‹redacted›")'));
});

test('the folder rewrite changes only files with a password and reports counts', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { redactLogFolder } = await import('./adapters/redact-files.ts');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-redact-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.log'), `# header\n${line('AUTHENTICATE("p", "secret1")')}\n${line('CHAT("x")')}\n`);
    fs.writeFileSync(path.join(dir, 'b.log'), `# header\n${line('CHAT("y")')}\n`);
    fs.writeFileSync(path.join(dir, 'notes.txt'), line('AUTHENTICATE("p", "secret2")'));
    assert.deepEqual(await redactLogFolder(dir), { files: 2, changedFiles: 1, changedLines: 1 });
    assert.doesNotMatch(fs.readFileSync(path.join(dir, 'a.log'), 'utf8'), /secret1/);
    assert.match(fs.readFileSync(path.join(dir, 'notes.txt'), 'utf8'), /secret2/, 'only .log files');
    assert.deepEqual(await redactLogFolder(dir), { files: 2, changedFiles: 0, changedLines: 0 }, 'running it twice changes nothing');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
