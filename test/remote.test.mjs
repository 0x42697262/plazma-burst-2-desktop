// Remote play: the lockdown (desktop/remote/lockdown.js) and the console's remote mode
// (desktop/dev/console/core/remote.js): "npm test".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { isBlockedKey, REMOTE_PAGE_SCRIPT } = createRequire(import.meta.url)('../desktop/remote/lockdown.js');
const { makeRedactor, HIDDEN } = await import(pathToFileURL(path.join(REPO, 'desktop/dev/console/core/remote.js')).href);

test('redactor: host paths, file names and game names are hidden; game text is not', () => {
  const r = makeRedactor({ chars: '$0Ме1А', latinOnly: '$pMcpo' });
  const cases = [
    ['Overrides are saved to desktop/dev-overrides.json.', `Overrides are saved to ${HIDDEN}.`],
    ['Saved map dm1 to desktop/maps', `Saved map dm1 to ${HIDDEN}`],
    ['see hooks/README.md and ANTICHEAT.md', `see ${HIDDEN} and ${HIDDEN}`],
    ['the game name "x" is not in names.js', `the game name "x" is not in ${HIDDEN}`],
    ['scripts/frame2.js:1234', `${HIDDEN}`],
    ['chars is $0Ме1А, region trigger $pMcpo', `chars is ${HIDDEN}, region trigger ${HIDDEN}`],
    ['any Cyrillic name $ееААT too', `any Cyrillic name ${HIDDEN} too`],
    ['typed: $0\\u041c\\u04351\\u0410[0].hea', `typed: ${HIDDEN}[0].hea`],
    ['Trigger #12 #door_open ran x3, HP 130/130', 'Trigger #12 #door_open ran x3, HP 130/130'],
    ['give rifle 3; vars set money $5', 'give rifle 3; vars set money $5'],
  ];
  for (const [input, want] of cases) assert.equal(r(input), want, input);
});

test('blocked keys: paste and host tools, not game keys', () => {
  for (const k of [
    { key: 'v', ctrl: true }, { code: 'KeyV', meta: true }, { key: 'Insert', shift: true },
    { key: 'I', ctrl: true, shift: true }, { key: 'u', ctrl: true }, { key: 'p', ctrl: true },
  ]) assert.equal(isBlockedKey(k), true, JSON.stringify(k));
  for (const k of [
    { key: 'v' }, { key: 'V', shift: true }, { key: 'F12' }, { key: 'F5' }, { key: 'r', ctrl: true },
    { key: '`', shift: true }, { key: 'c', ctrl: true }, { key: 'Insert' }, { key: 'w' }, { key: ' ' },
  ]) assert.equal(isBlockedKey(k), false, JSON.stringify(k));
});

test('the page script sets PB2_REMOTE without making it enumerable', () => {
  assert.match(REMOTE_PAGE_SCRIPT, /Object\.defineProperty\(globalThis, "PB2_REMOTE", \{ value: true \}\)/);
  assert.match(REMOTE_PAGE_SCRIPT, /addEventListener\("paste"/);
});

// Remote mode is decided when the console's modules load, so it runs in its own process.
const REMOTE_CHILD = `
  globalThis.PB2_REMOTE = true;
  const { bootConsole, CONSOLE_ENTRY } = await import(${JSON.stringify(pathToFileURL(path.join(REPO, 'test/fake-game.mjs')).href)});
  const c = await bootConsole();
  const at = (rel) => new URL(rel, ${JSON.stringify(pathToFileURL(path.join(REPO, 'desktop/dev/console/')).href)}).href;
  const { attachLog, print } = await import(at('ui/log.js'));
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
