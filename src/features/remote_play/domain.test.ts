import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REMOTE_PAGE_SCRIPT } from './keys.ts';
import { HIDDEN } from './text.ts';
import { makeRedactor } from '#console/kernel/redaction/redactor.ts';
import { isBlockedKey, fromElectronInput } from './domain/blocked-keys.ts';
import { isGamePage, isRefusedPageLoad } from './domain/game-page.ts';
import { toInputEvents, releaseAll } from './domain/input.ts';
import { parseHostArgs } from './domain/host-args.ts';
import { clientAddress } from './domain/client-address.ts';
import { createWrongLinks } from './domain/wrong-links.ts';

const SIZE = { width: 960, height: 540 };
const START = 'https://www.plazmaburst2.com/h5/versions/v1/';

test('redactor: host paths, file names and game names are hidden; game text is not', () => {
  const redact = makeRedactor({ chars: '$0Ме1А', latinOnly: '$pMcpo' });
  const cases: [string, string][] = [
    ['Overrides are saved to data/dev-overrides.json.', `Overrides are saved to ${HIDDEN}.`],
    ['Saved map dm1 to data/maps', `Saved map dm1 to ${HIDDEN}`],
    ['see hooks/README.md and ANTICHEAT.md', `see ${HIDDEN} and ${HIDDEN}`],
    ['the why is in docs/research/anticheat.md §6.', `the why is in ${HIDDEN} §6.`],
    ['the game name "x" is not in names.js', `the game name "x" is not in ${HIDDEN}`],
    ['scripts/frame2.js:1234', `${HIDDEN}`],
    ['failed in src/features/zoom/console.ts', `failed in ${HIDDEN}`],
    ['built from client.ts', `built from ${HIDDEN}`],
    ['chars is $0Ме1А, region trigger $pMcpo', `chars is ${HIDDEN}, region trigger ${HIDDEN}`],
    ['any Cyrillic name $ееААT too', `any Cyrillic name ${HIDDEN} too`],
    ['typed: $0\\u041c\\u04351\\u0410[0].hea', `typed: ${HIDDEN}[0].hea`],
    ['Trigger #12 #door_open ran x3, HP 130/130', 'Trigger #12 #door_open ran x3, HP 130/130'],
    ['give rifle 3; vars set money $5', 'give rifle 3; vars set money $5'],
  ];
  for (const [input, want] of cases) assert.equal(redact(input), want, input);
});

test('blocked keys: paste and host tools, not game keys', () => {
  for (const press of [
    { key: 'v', ctrl: true }, { code: 'KeyV', meta: true }, { key: 'Insert', shift: true },
    { key: 'I', ctrl: true, shift: true }, { key: 'u', ctrl: true }, { key: 'p', ctrl: true },
  ]) assert.equal(isBlockedKey(press), true, JSON.stringify(press));
  for (const press of [
    { key: 'v' }, { key: 'V', shift: true }, { key: 'F12' }, { key: 'F5' }, { key: 'r', ctrl: true },
    { key: '`', shift: true }, { key: 'c', ctrl: true }, { key: 'Insert' }, { key: 'w' }, { key: ' ' },
  ]) assert.equal(isBlockedKey(press), false, JSON.stringify(press));
  assert.equal(isBlockedKey(fromElectronInput({ key: 'v', code: 'KeyV', control: true, meta: false, shift: false, alt: false })), true);
});

test('the page script sets PB2_REMOTE without making it enumerable, and shuts the clipboard both ways', () => {
  assert.match(REMOTE_PAGE_SCRIPT, /Object\.defineProperty\(globalThis, "PB2_REMOTE", \{ value: true \}\)/);
  assert.match(REMOTE_PAGE_SCRIPT, /\["paste", "copy", "cut"\]/);
  assert.match(REMOTE_PAGE_SCRIPT, /"writeText"/);
});

test('a remote window may only load the game\'s start page', () => {
  for (const allowed of [START, `${START}?x=1`, `${START}#a`]) assert.equal(isGamePage(allowed, START), true, allowed);
  for (const refused of [`${START}__dev/console/index.js`, `${START}__hooks/hook/a.js`, `${START}scripts/frame2.js`,
    'https://www.plazmaburst2.com/', 'https://evil.example/h5/versions/v1/', 'javascript:alert(1)', 'file:///etc/passwd', 'nonsense']) {
    assert.equal(isGamePage(refused, START), false, refused);
  }
  assert.equal(isRefusedPageLoad('document', `${START}__dev/console/index.js`, START), true);
  assert.equal(isRefusedPageLoad('iframe', START, START), false);
  assert.equal(isRefusedPageLoad('script', `${START}scripts/frame2.js`, START), false, 'scripts load as usual');
  assert.equal(isRefusedPageLoad(null, `${START}scripts/frame2.js`, START), false);
});

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
  assert.deepEqual(toInputEvents({ t: 'kd', code: 'Numpad7', key: '7' }, SIZE)[0], { type: 'keyDown', keyCode: 'num7', modifiers: [] });
});

test('input: paste and junk become nothing', () => {
  for (const message of [
    { t: 'kd', code: 'KeyV', key: 'v', m: 2 }, { t: 'kd', code: 'Insert', key: 'Insert', m: 1 },
    { t: 'kd', code: 'KeyI', key: 'I', m: 3 }, { t: 'kd', code: 'Nope', key: 'x' }, { t: 'kd', code: 'x'.repeat(100) },
    { t: 'mm', x: 'a', y: 1 }, { t: 'md', x: 1, y: 1, b: 7 }, { t: 'zz' }, null, 'kd', { t: 'wh', x: 1, y: 1, dx: NaN, dy: 0 },
  ]) assert.deepEqual(toInputEvents(message, SIZE), [], JSON.stringify(message));
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

test('host args: defaults, overrides, and problems for bad values', () => {
  assert.deepEqual(parseHostArgs([]).options, { port: 8787, bind: '127.0.0.1', maxGames: 4, fps: 30, quality: 60, width: 960, height: 540 });
  const { options, problems } = parseHostArgs(['--host', '--port=9000', '--public', '--max=8', '--fps=99', '--size=1280x720']);
  assert.equal(options.port, 9000);
  assert.equal(options.bind, '0.0.0.0');
  assert.equal(options.maxGames, 8);
  assert.equal(options.fps, 30);
  assert.deepEqual([options.width, options.height], [1280, 720]);
  assert.match(problems.join(), /--fps must be/);
  assert.match(parseHostArgs(['--size=10x10']).problems.join(), /--size must be WIDTHxHEIGHT, from 320x180 to 1920x1080/);
});

test('client address: a forwarded address counts only through a tunnel on this machine', () => {
  assert.equal(clientAddress('203.0.113.9', { 'x-forwarded-for': '1.2.3.4' }), '203.0.113.9');
  assert.equal(clientAddress('127.0.0.1', { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }), '1.2.3.4');
  assert.equal(clientAddress('::1', { 'cf-connecting-ip': '5.6.7.8', 'x-forwarded-for': '1.2.3.4' }), '5.6.7.8');
  assert.equal(clientAddress('127.0.0.1', {}), '127.0.0.1');
  assert.equal(clientAddress(undefined, {}), '?');
});

test('wrong links: the first and the limit are noted; the limit lifts after its window', () => {
  let now = 0;
  const wrongLinks = createWrongLinks(() => now);
  const notes = Array.from({ length: 10 }, () => wrongLinks.note('a'));
  assert.equal(notes[0], 'first');
  assert.equal(notes[9], 'limit');
  assert.equal(notes.filter((note) => note === 'quiet').length, 8);
  assert.equal(wrongLinks.isLimited('a'), true);
  assert.equal(wrongLinks.isLimited('b'), false);
  now = 60001;
  assert.equal(wrongLinks.isLimited('a'), false);
});
