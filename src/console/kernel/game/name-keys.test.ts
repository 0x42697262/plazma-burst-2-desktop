import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expectedKeys } from '#tools/find-names/find-names.ts';
import { NAME_KEYS } from './keys.ts';

test('the console knows exactly the names find-names finds', () => {
  assert.deepEqual([...NAME_KEYS].sort(), [...new Set(expectedKeys())].sort());
});
