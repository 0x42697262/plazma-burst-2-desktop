import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entryOf, sharedWith } from './entry.ts';

const row = (since: number, extra: Record<string, unknown> = {}) => ({ since, from: 'player-one', to: 'player-two', is_active: true, ...extra });

test('an entry is told by the fixed start times of its relations, in any order', () => {
  const first = entryOf([row(1700000000000), row(1700000500000), row(1690000000000)]);
  const again = entryOf([row(1690000000000), row(1700000000000), row(1700000500000, { is_active: false })]);
  assert.equal(first.tag, again.tag);
  assert.match(first.tag ?? '', /^[0-9a-f]{8}$/);
  assert.equal(first.relations, 3);
  assert.equal(first.oldest, 1690000000000);
  assert.notEqual(entryOf([row(1690000000001)]).tag, first.tag);
});

test('no relations is an entry with no tag; rows without a start time are skipped', () => {
  assert.deepEqual(entryOf([]), { tag: null, relations: 0, oldest: null, starts: [] });
  assert.deepEqual(entryOf([{ from: 'a' }, 'x', null]).relations, 0);
});

test('two entries that share relations are likely the same entry, with some relations added or ended', () => {
  const before = entryOf([row(1), row(2), row(3), row(4)]);
  const after = entryOf([row(2), row(3), row(4), row(5)]);
  assert.equal(sharedWith(before, after), 3);
  assert.equal(sharedWith(before, entryOf([row(9)])), 0);
});
