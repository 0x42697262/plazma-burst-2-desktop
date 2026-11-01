import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stringOf, textOf } from './text-of.ts';

test('stringOf prints like String(): arrays joined, objects as [object Object], null and undefined by name', () => {
  assert.equal(stringOf([1, 2]), '1,2');
  assert.equal(stringOf({}), '[object Object]');
  assert.equal(stringOf(null), 'null');
  assert.equal(stringOf(undefined), 'undefined');
  assert.equal(stringOf(5), '5');
  assert.equal(stringOf('text'), 'text');
});

test('textOf prints objects as JSON', () => {
  assert.equal(textOf({ key: 1 }), '{"key":1}');
  assert.equal(textOf(null), 'null');
});
