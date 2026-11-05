import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareIndex, type IndexOptions } from './index-page.ts';

const GAME_INDEX = '<html><body><script src="scripts/flash.js"></script><script src="scripts/main.js"></script><script>//# sourceURL=scripts/main.js</script></body></html>';
const NONE: IndexOptions = { hooks: null, pageScripts: null, join: null, serverPage: null, remoteScript: null, remoteNotMarked: 'not marked', verbose: false, isServer: false };

test('the console goes after the game\'s scripts, or before </body> when the tag changed', () => {
  assert.match(prepareIndex(GAME_INDEX, { ...NONE, pageScripts: '<DEV>' }).html ?? '', /sourceURL=scripts\/main\.js<\/script><DEV><\/body>/);
  assert.match(prepareIndex('<body><script src="x.js"></script></body>', { ...NONE, pageScripts: '<DEV>' }).html ?? '', /<DEV><\/body>/);
  assert.deepEqual(prepareIndex('<p>no body</p>', { ...NONE, pageScripts: '<DEV>' }).errors, ['Page scripts: could not inject into index.html']);
});

test('a private server\'s address goes before every script, and "<" in it cannot end the script', () => {
  const prepared = prepareIndex(GAME_INDEX, { ...NONE, join: { hostPort: 'x</script><script>alert(1)//', nickname: 'me', password: 'pw' } });
  assert.match(prepared.html ?? '', /^<html><body><script>Object\.defineProperty\(globalThis, "PB2_JOIN"/);
  assert.doesNotMatch(prepared.html ?? '', /x<\/script>/);
  assert.equal(prepareIndex('<body></body>', { ...NONE, join: { hostPort: 'a:1' } }).html, null, 'no script tag: not served');
});

test('the dedicated host gets PB2_SERVER first and chat lines from trace(); a tester\'s page is marked before anything else', () => {
  const hosted = prepareIndex(GAME_INDEX, { ...NONE, isServer: true, serverPage: { match: { title: 't' } }, join: { hostPort: 'ignored' } });
  assert.match(hosted.html ?? '', /^<html><body><script>Object\.defineProperty\(globalThis, "PB2_SERVER"/);
  assert.match(hosted.html ?? '', /flash\.js"><\/script><script>trace = function/);
  assert.doesNotMatch(hosted.html ?? '', /PB2_JOIN/);
  assert.equal(prepareIndex('<body><script src="x.js"></script></body>', { ...NONE, isServer: true }).html, null);
  const remote = prepareIndex(GAME_INDEX, { ...NONE, remoteScript: '<REMOTE>', pageScripts: '<DEV>', join: { hostPort: 'ignored' } });
  assert.match(remote.html ?? '', /^<html><body><REMOTE><script src="scripts\/flash\.js">/);
  assert.doesNotMatch(remote.html ?? '', /PB2_JOIN/);
  assert.deepEqual(prepareIndex('<body></body>', { ...NONE, remoteScript: '<REMOTE>' }).errors, ['not marked']);
});

test('verbose: the game\'s trace() goes to the log, or a warning says it stays silent', () => {
  assert.match(prepareIndex(GAME_INDEX, { ...NONE, verbose: true }).html ?? '', /flash\.js"><\/script><script>trace = console\.debug/);
  assert.deepEqual(prepareIndex('<body></body>', { ...NONE, verbose: true }).warnings, ['Verbose: scripts/flash.js not found in index.html; the game\'s trace() stays silent']);
});

test('a saved account\'s script goes before every script, so the game\'s loader finds the token', () => {
  const html = prepareIndex(GAME_INDEX, { ...NONE, accountScript: '<ACCOUNT>' }).html ?? '';
  assert.ok(html.indexOf('<ACCOUNT>') < html.indexOf('<script'));
});
