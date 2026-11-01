import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeNumber, showPart, splitParts, unescField } from './codec.ts';
import { tap, untap } from './tap.ts';

const DIGITS = 'abcdefghij';

test('numbers are base N in the game\'s digits; anything else is not a number', () => {
  assert.equal(decodeNumber('ba', DIGITS), 10);
  assert.equal(decodeNumber('-c', DIGITS), -2);
  assert.equal(decodeNumber('-', DIGITS), null);
  assert.equal(decodeNumber('z', DIGITS), null);
  assert.equal(decodeNumber('', DIGITS), null);
  assert.equal(decodeNumber('a', ''), null);
});

test('escaped separators come back; parts are split and unescaped', () => {
  assert.equal(unescField('a$.1b'), 'a\x01b');
  assert.deepEqual(splitParts('x\x02y$.2z$.1w'), ['x', 'y\x02z\x01w']);
});

test('a part shows as a number, JSON as it is, text in quotes, cut over 2000 characters unless whole', () => {
  assert.equal(showPart('\x01', '\x00\x01'), '1');
  assert.equal(showPart('b', DIGITS, true), '1');
  assert.equal(showPart('b', DIGITS), '"b"');
  assert.equal(showPart('{"a":1}', DIGITS), '{"a":1}');
  assert.equal(showPart('[nope', DIGITS), '"[nope"');
  const long = 'x'.repeat(2001);
  assert.equal(showPart(long, DIGITS), `${JSON.stringify('x'.repeat(2000))}...(2001 chars)`);
  assert.equal(showPart(long, DIGITS, false, true), JSON.stringify(long));
});

test('two owners share one wrapper; it goes with the last listener and restores the method', () => {
  class Connection { receive(text: string) { return `got ${text}`; } }
  const connection = new Connection() as Connection & Record<string, unknown>;
  const seen: string[] = [];
  tap(connection, 'receive', 'first', (text) => { seen.push(`first ${String(text)}`); });
  tap(connection, 'receive', 'second', () => { throw new Error('a listener error never reaches the game'); });
  assert.equal(connection.receive('a'), 'got a');
  assert.deepEqual(seen, ['first a']);
  untap(connection, 'receive', 'first');
  assert.ok(Object.hasOwn(connection, 'receive'));
  untap(connection, 'receive', 'second');
  assert.ok(!Object.hasOwn(connection, 'receive'), 'back to the class method');
  const own = { send: (text: string) => text };
  const original = own.send;
  tap(own, 'send', 'first', () => undefined);
  untap(own, 'send', 'first');
  assert.equal(own.send, original, 'an own method is put back');
  tap(null, 'x', 'first', () => undefined);
  tap({ notAFunction: 1 }, 'notAFunction', 'first', () => undefined);
});

test('a rewriter changes what the method gets; listeners still see the original; the wrapper goes with the last owner', async () => {
  const { rewriteArguments } = await import('./tap.ts');
  const { joinParts, escPart } = await import('./codec.ts');
  class Connection { got: unknown[] = []; receive(text: string) { this.got.push(text); } }
  const connection = new Connection() as Connection & Record<string, unknown>;
  const seen: unknown[] = [];
  tap(connection, 'receive', 'listener', (text) => { seen.push(text); });
  rewriteArguments(connection, 'receive', 'guard', ([text]) => [String(text).toUpperCase()]);
  rewriteArguments(connection, 'receive', 'broken', () => { throw new Error('ignored'); });
  connection.receive('abc');
  assert.deepEqual(seen, ['abc']);
  assert.deepEqual(connection.got, ['ABC']);
  untap(connection, 'receive', 'listener');
  untap(connection, 'receive', 'broken');
  assert.ok(Object.hasOwn(connection, 'receive'), 'the guard still rewrites');
  untap(connection, 'receive', 'guard');
  assert.ok(!Object.hasOwn(connection, 'receive'));
  assert.equal(escPart('a\x01b\x02c'), 'a$.1b$.2c');
  assert.deepEqual(splitParts(joinParts(['x\x02y', 'z'])), ['x\x02y', 'z']);
});
