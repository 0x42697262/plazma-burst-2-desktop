import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HIDDEN } from './text.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const REMOTE_CHILD = `
  globalThis.PB2_REMOTE = true;
  const { bootConsole, CONSOLE_ENTRY } = await import(${JSON.stringify(pathToFileURL(path.join(REPO, 'test/fake-game.mjs')).href)});
  const c = await bootConsole();
  const at = (rel) => new URL(rel, ${JSON.stringify(pathToFileURL(path.join(REPO, 'desktop/dev/console/')).href)}).href;
  const { attachLog, print } = await import(at('../../../src/console/kernel/ui/log.ts'));
  const { findRunnable } = await import(at('commands/registry.js'));
  const pane = { childNodes: [], append(n) { this.childNodes.push(n); }, get firstChild() { return this.childNodes[0]; }, scrollTop: 0, scrollHeight: 0 };
  attachLog(pane);
  print('Overrides are saved to desktop/dev-overrides.json, chars is $0Ме1А');
  const shown = pane.childNodes.map((line) => (line.childNodes || []).map((s) => s.text).join(''));
  process.stdout.write(JSON.stringify({
    js: !!findRunnable('js'), hooks: !!findRunnable('hooks'), god: !!findRunnable('god') || !!findRunnable('help'),
    jsRun: c.run('js 1+1'), help: c.run('help').join('\\n'), logic: c.run('help logic').join('\\n'), shown,
  }));
`;

test('remote mode: "js" and "hooks" do not exist, the anti-cheat note is gone, the pane hides paths and names', () => {
  const out = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', REMOTE_CHILD], { cwd: REPO, encoding: 'utf8' }));
  assert.equal(out.js, false);
  assert.equal(out.hooks, false);
  assert.equal(out.god, true);
  assert.match(out.jsRun.join(' '), /unknown command "js"/);
  assert.doesNotMatch(out.help, /^\s*js\b|^\s*hooks\b/m);
  assert.doesNotMatch(out.logic, /anti-cheat/);
  assert.equal(out.shown.length, 1);
  assert.equal(out.shown[0], `Overrides are saved to ${HIDDEN}, chars is ${HIDDEN}`);
});

const SWEEP_CHILD = `
  globalThis.PB2_REMOTE = true;
  const { bootConsole } = await import(${JSON.stringify(pathToFileURL(path.join(REPO, 'test/fake-game.mjs')).href)});
  const c = await bootConsole();
  const at = (rel) => new URL(rel, ${JSON.stringify(pathToFileURL(path.join(REPO, 'desktop/dev/console/')).href)}).href;
  const { attachLog } = await import(at('../../../src/console/kernel/ui/log.ts'));
  const { helpEntries } = await import(at('commands/registry.js'));
  const pane = { childNodes: [], append(n) { this.childNodes.push(n); }, get firstChild() { return this.childNodes[0]; }, scrollTop: 0, scrollHeight: 0 };
  attachLog(pane);
  const out = [];
  const cmds = ['help', 'list', 'maps', 'screenshot', 'game help', 'guns', 'chars', 'triggers', 'triggers 1', 'triggers history',
    'vars', 'logic', 'regions', 'trace', 'profile list', 'binds', 'keyname', 'editor status', 'more', 'nonsense', 'set nope 1', 'help nope',
    ...helpEntries().map((e) => 'help ' + e.id)];
  for (const cmd of cmds) {
    pane.childNodes.length = 0;
    c.run(cmd);
    for (const l of pane.childNodes) out.push([cmd, (l.childNodes || []).map((s) => s.text).join('')]);
  }
  process.stdout.write(JSON.stringify(out));
`;

test('remote mode: no command or help page shows code, paths, file names, game names, the anti-cheat, hooks or eval', () => {
  const lines = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', SWEEP_CHILD], { cwd: REPO, encoding: 'utf8', maxBuffer: 64e6 }));
  assert.ok(lines.length > 500, `only ${lines.length} lines`);
  const LEAK = [
    [/\$[0-9A-Za-z_\u0400-\u04FF]{3,}/, 'obfuscated-looking name'],
    [/__pb2_|PB2_[A-Z]|pb2dev\./, 'internal global'],
    [/\.(js|mjs|cjs|json|md)\b/, 'file name'],
    [/\b(desktop|hooks|tools|scripts|game|__dev|__hooks)\//, 'path'],
    [/=>|function\s*\(|\bconst \w|\bimport /, 'code'],
    [/anti-?cheat|anti-tamper|tamper|ANTICHEAT|integrity|stack check/i, 'anti-cheat'],
    [/\bhooks?\b/i, 'hooks'],
    [/\beval\b|devtools/i, 'eval or DevTools'],
  ];
  const hits = [];
  for (const [cmd, text] of lines) for (const [re, why] of LEAK) if (re.test(text)) hits.push(`${why} [${cmd}] ${text}`);
  assert.deepEqual(hits, []);
});
