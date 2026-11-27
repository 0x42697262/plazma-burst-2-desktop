import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fieldShown, isStorableText, parseFieldValue, uploadSkipsName, uploadSkipsValue } from './fields.ts';

test('a typed value becomes what the game\'s own loader makes of the same text', () => {
  assert.equal(parseFieldValue('5'), 5);
  assert.equal(parseFieldValue('0.5'), 0.5);
  assert.equal(parseFieldValue('-3'), -3);
  assert.equal(parseFieldValue('true'), true);
  assert.equal(parseFieldValue('false'), false);
  assert.equal(parseFieldValue('hello there'), 'hello there');
  assert.equal(parseFieldValue('"5"'), '"5"');
  for (const text of ['', 'NaN', 'undefined']) assert.equal(isStorableText(text), false, text);
});

test('values are shown with their type, the proof never', () => {
  assert.equal(fieldShown('volume', 0.5), '0.5');
  assert.equal(fieldShown('altcur', true), 'true');
  assert.equal(fieldShown('cmpg_nick', 'Player'), '"Player"');
  assert.equal(fieldShown('first_login_proof', 'secret'), '‹hidden›');
});

test('what the upload skips is known', () => {
  for (const name of ['skin_allowed_3', 'a b', 'a.b', 'a:b', 'a"b', 'a(b', 'a<b', '']) assert.equal(uploadSkipsName(name), true, name);
  for (const name of ['volume', "it's"]) assert.equal(uploadSkipsName(name), false, name);
  assert.equal(uploadSkipsValue('see document.cookie'), true);
  assert.equal(uploadSkipsValue("a 'script' b"), true);
  assert.equal(uploadSkipsValue(5), false);
});
