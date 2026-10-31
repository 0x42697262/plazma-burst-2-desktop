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

// ---------------------------------------------------------------------------
// Host: input, testers, the server (desktop/remote/input.js, testers.js, host.js)
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import os from 'node:os';

const req = createRequire(import.meta.url);
const { toInputEvents, releaseAll } = req('../desktop/remote/input.js');
const { addTester, removeTester, findTester, listTesters } = req('../desktop/remote/testers.js');
const { startHost, parseHostArgs, CLOSE } = req('../desktop/remote/host.js');
const { WebSocket } = req('ws');

const SIZE = { width: 960, height: 540 };

test('input: keys become Electron key events, typed characters also a "char"', () => {
  assert.deepEqual(toInputEvents({ t: 'kd', code: 'KeyA', key: 'a', m: 0 }, SIZE), [
    { type: 'keyDown', keyCode: 'A', modifiers: [] }, { type: 'char', keyCode: 'a', modifiers: [] }]);
  assert.deepEqual(toInputEvents({ t: 'kd', code: 'Backquote', key: '~', m: 1 }, SIZE), [
    { type: 'keyDown', keyCode: '`', modifiers: ['shift'] }, { type: 'char', keyCode: '~', modifiers: ['shift'] }]);
  assert.deepEqual(toInputEvents({ t: 'kd', code: 'ArrowLeft', key: 'ArrowLeft', m: 0, r: true }, SIZE), [
    { type: 'keyDown', keyCode: 'Left', modifiers: ['isAutoRepeat'] }]);
  assert.deepEqual(toInputEvents({ t: 'ku', code: 'Space', key: ' ', m: 0 }, SIZE), [{ type: 'keyUp', keyCode: 'Space', modifiers: [] }]);
  assert.deepEqual(toInputEvents({ t: 'kd', code: 'F5', key: 'F5' }, SIZE), [{ type: 'keyDown', keyCode: 'F5', modifiers: [] }]);
  assert.deepEqual(toInputEvents({ t: 'kd', code: 'KeyC', key: 'c', m: 2 }, SIZE), [{ type: 'keyDown', keyCode: 'C', modifiers: ['control'] }]);
});

test('input: paste and junk become nothing', () => {
  for (const msg of [
    { t: 'kd', code: 'KeyV', key: 'v', m: 2 }, { t: 'kd', code: 'Insert', key: 'Insert', m: 1 },
    { t: 'kd', code: 'KeyI', key: 'I', m: 3 }, { t: 'kd', code: 'Nope', key: 'x' }, { t: 'kd', code: 'x'.repeat(100) },
    { t: 'mm', x: 'a', y: 1 }, { t: 'md', x: 1, y: 1, b: 7 }, { t: 'zz' }, null, 'kd', { t: 'wh', x: 1, y: 1, dx: NaN, dy: 0 },
  ]) assert.deepEqual(toInputEvents(msg, SIZE), [], JSON.stringify(msg));
});

test('input: mouse positions are clamped to the stream; wheel turns DOM deltas around', () => {
  assert.deepEqual(toInputEvents({ t: 'mm', x: -5, y: 9999 }, SIZE), [{ type: 'mouseMove', x: 0, y: 539, modifiers: [] }]);
  assert.deepEqual(toInputEvents({ t: 'md', x: 10.4, y: 20.6, b: 2, m: 1 }, SIZE), [
    { type: 'mouseDown', x: 10, y: 21, button: 'right', clickCount: 1, modifiers: ['shift'] }]);
  assert.deepEqual(toInputEvents({ t: 'wh', x: 1, y: 2, dx: 0, dy: 120 }, SIZE), [
    { type: 'mouseWheel', x: 1, y: 2, deltaX: -0, deltaY: -120, canScroll: true, modifiers: [] }]);
  assert.deepEqual(releaseAll(['KeyD', 'Bogus', 'ShiftLeft']), [
    { type: 'keyUp', keyCode: 'D', modifiers: [] }, { type: 'keyUp', keyCode: 'Shift', modifiers: [] }]);
});

function tempTesters() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-remote-'));
  return { file: path.join(dir, 'testers.json'), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test('testers: add gives a token that finds them; a new add replaces the old token; remove ends it', () => {
  const t = tempTesters();
  try {
    const a = addTester(t.file, 'Alice');
    assert.equal(a.name, 'alice');
    assert.ok(a.token.length >= 32);
    assert.deepEqual(findTester(t.file, a.token), { name: 'alice' });
    assert.equal(findTester(t.file, a.token + 'x'), null);
    assert.equal(findTester(t.file, ''), null);
    const a2 = addTester(t.file, 'alice');
    assert.equal(findTester(t.file, a.token), null);
    assert.deepEqual(findTester(t.file, a2.token), { name: 'alice' });
    assert.deepEqual(listTesters(t.file).map((x) => x.name), ['alice']);
    assert.equal(removeTester(t.file, 'alice'), true);
    assert.equal(findTester(t.file, a2.token), null);
    assert.throws(() => addTester(t.file, '../evil'), /tester name/);
    assert.equal((fs.statSync(t.file).mode & 0o777).toString(8), '600');
  } finally { t.cleanup(); }
});

test('host args: defaults, overrides, and problems for bad values', () => {
  assert.deepEqual(parseHostArgs([]).options, { port: 8787, bind: '127.0.0.1', maxGames: 4, fps: 30, quality: 60, width: 960, height: 540 });
  const { options, problems } = parseHostArgs(['--host', '--port=9000', '--public', '--max=8', '--fps=99', '--size=1280x720']);
  assert.equal(options.port, 9000);
  assert.equal(options.bind, '0.0.0.0');
  assert.equal(options.maxGames, 8);
  assert.equal(options.fps, 30);
  assert.deepEqual([options.width, options.height], [1280, 720]);
  assert.match(problems.join(), /--fps must be/);
});

// A game as desktop/main.js makes it, without Electron.
function fakeGame(name, record) {
  const frameFns = new Set();
  const goneFns = [];
  const g = {
    name, inputs: [], destroyed: false, refreshed: 0, focused: 0,
    size: { ...SIZE },
    onFrame(fn) { frameFns.add(fn); return () => frameFns.delete(fn); },
    sendInput(ev) { g.inputs.push(ev); },
    focus() { g.focused++; },
    refresh() { g.refreshed++; },
    destroy() { g.destroyed = true; },
    onGone(fn) { goneFns.push(fn); },
    paint(bytes = Buffer.from([0xff, 0xd8, 0xff])) { let n = 0; for (const fn of frameFns) fn(() => { n++; return bytes; }); return n; },
    crash() { for (const fn of goneFns) fn(); },
  };
  record.push(g);
  return g;
}

async function hostFixture(opts = {}) {
  const t = tempTesters();
  const games = [];
  const logs = [];
  const log = { info: (m) => logs.push(m), warn: (m) => logs.push(m), error: (m) => logs.push(m) };
  const host = startHost({ port: 0, testersFile: t.file, createGame: async (tester) => fakeGame(tester.name, games), log, fps: 1000, ...opts });
  const port = await host.ready;
  const base = `http://127.0.0.1:${port}`;
  const open = (token) => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const got = { json: [], binary: [], closed: null };
    ws.on('message', (d, bin) => (bin ? got.binary.push(d) : got.json.push(JSON.parse(String(d)))));
    ws.on('close', (code) => { got.closed = code; });
    ws.on('open', () => { ws.send(JSON.stringify({ t: 'hello', token })); resolve({ ws, got }); });
  });
  const until = async (cond, ms = 2000) => {
    const end = Date.now() + ms;
    while (!cond()) { if (Date.now() > end) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 10)); }
  };
  return { t, host, base, games, logs, open, until, cleanup: async () => { await host.close(); t.cleanup(); } };
}

test('host: serves only the client page, nothing else', async () => {
  const f = await hostFixture();
  try {
    const page = await fetch(`${f.base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
    assert.match(await page.text(), /client\.js/);
    assert.equal((await fetch(`${f.base}/client.js`)).status, 200);
    for (const p of ['/host.js', '/../host.js', '/client/../host.js', '/%2e%2e/main.js', '/index.html', '/ws', '/desktop/main.js']) {
      assert.equal((await fetch(`${f.base}${p}`)).status, 404, p);
    }
    assert.equal((await fetch(`${f.base}/`, { method: 'POST' })).status, 404);
  } finally { await f.cleanup(); }
});

test('host: a bad link is refused; a good one gets a game, frames out, input in, paste dropped', async () => {
  const f = await hostFixture();
  try {
    const bad = await f.open('nope');
    await f.until(() => bad.got.closed);
    assert.equal(bad.got.closed, CLOSE.badToken);
    assert.match(bad.got.json[0].message, /not valid/);
    assert.equal(f.games.length, 0);

    const { token } = addTester(f.t.file, 'bob');
    const c = await f.open(token);
    await f.until(() => c.got.json.length);
    assert.deepEqual(c.got.json[0], { t: 'ready', name: 'bob', width: 960, height: 540 });
    const g = f.games[0];
    assert.equal(g.focused, 1);
    assert.equal(g.refreshed, 1);
    assert.equal(g.paint(), 1);
    await f.until(() => c.got.binary.length);
    assert.deepEqual([...c.got.binary[0]], [0xff, 0xd8, 0xff]);

    c.ws.send(JSON.stringify({ t: 'kd', code: 'KeyD', key: 'd', m: 0 }));
    c.ws.send(JSON.stringify({ t: 'kd', code: 'KeyV', key: 'v', m: 2 }));
    c.ws.send(JSON.stringify({ t: 'mm', x: 5, y: 6 }));
    await f.until(() => g.inputs.some((e) => e.type === 'mouseMove'));
    assert.deepEqual(g.inputs.map((e) => e.type), ['keyDown', 'char', 'mouseMove']);

    c.ws.close();
    await f.until(() => g.inputs.some((e) => e.type === 'keyUp'));
    assert.deepEqual(g.inputs.at(-1), { type: 'keyUp', keyCode: 'D', modifiers: [] }); // released on leave
    assert.equal(g.paint(), 0); // no one to send frames to
    assert.equal(g.destroyed, false); // kept for a reconnect
  } finally { await f.cleanup(); }
});

test('host: a reconnect continues the same game; a second tab takes it over', async () => {
  const f = await hostFixture();
  try {
    const { token } = addTester(f.t.file, 'cat');
    const a = await f.open(token);
    await f.until(() => a.got.json.length);
    const b = await f.open(token);
    await f.until(() => b.got.json.length && a.got.closed);
    assert.equal(a.got.closed, CLOSE.replaced);
    assert.match(a.got.json.at(-1).message, /opened somewhere else/);
    assert.equal(f.games.length, 1);
    assert.equal(f.games[0].paint(), 1);
  } finally { await f.cleanup(); }
});

test('host: full means full; an idle game is closed; a crashed game tells the tester', async () => {
  const f = await hostFixture({ maxGames: 1, idleMs: 50 });
  try {
    const one = addTester(f.t.file, 'one').token;
    const two = addTester(f.t.file, 'two').token;
    const a = await f.open(one);
    await f.until(() => a.got.json.length);
    const b = await f.open(two);
    await f.until(() => b.got.closed);
    assert.equal(b.got.closed, CLOSE.full);
    a.ws.close();
    await f.until(() => f.games[0].destroyed);
    const c = await f.open(two);
    await f.until(() => c.got.json.length);
    f.games[1].crash();
    await f.until(() => c.got.closed);
    assert.equal(c.got.closed, CLOSE.gone);
    assert.match(c.got.json.at(-1).message, /stopped/);
  } finally { await f.cleanup(); }
});

test('host: no hello, or a wrong first message, is dropped', async () => {
  const f = await hostFixture();
  try {
    const ws = new WebSocket(f.base.replace('http', 'ws') + '/ws');
    const closed = new Promise((r) => ws.on('close', (code) => r(code)));
    await new Promise((r) => ws.on('open', r));
    ws.send(JSON.stringify({ t: 'kd', code: 'KeyA' }));
    assert.equal(await closed, CLOSE.protocol);
  } finally { await f.cleanup(); }
});
