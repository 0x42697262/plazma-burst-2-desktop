import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationText, listReplyOf, relationOf } from './reply.ts';

test('a list reply gives your numbers and the rows; a refusal gives its reason', () => {
  const own = '{"reputation":17,"reputation_potential":20,"skill":0.25,"wins":3,"loses":1,"online":20,"matches":8}';
  assert.deepEqual(listReplyOf(['ok', '[]', own]), {
    ok: true, reason: '', rows: [], own: { reputation: 17, potential: 20, skill: 0.25, wins: 3, losses: 1 },
  });
  assert.deepEqual(listReplyOf(['fail', 'Match listing error: Too fast']), { ok: false, reason: 'Match listing error: Too fast', rows: [], own: null });
  assert.deepEqual(listReplyOf(['ok', 'not json', '{']), { ok: true, reason: '', rows: [], own: null });
  assert.deepEqual(listReplyOf(null), { ok: false, reason: '', rows: [], own: null });
});

test('a relation row reads as who, which way, its delta and how long it lasts', () => {
  const row = { is_mine: 1, from: 'me', to: 'bob', is_support: 1, personal_delta: 0, relative_since: -2 * 86400000, relative_cap_time_until: 3 * 3600000, is_active: true };
  assert.deepEqual(relationOf(row), { mine: true, from: 'me', to: 'bob', fit: true, delta: 0, since: 2 * 86400000, until: 3 * 3600000, active: true });
  assert.deepEqual(relationOf({ from: 'x', to: 'me', is_support: 0, personal_delta: -2, relative_since: -60000, relative_cap_time_until: -1000, is_active: false }),
    { mine: false, from: 'x', to: 'me', fit: false, delta: -2, since: 60000, until: -1000, active: false });
  assert.equal(relationOf('nope'), null);
});

test('durations read in the largest units that fit', () => {
  assert.equal(durationText(0), '0m');
  assert.equal(durationText(59 * 1000), '0m');
  assert.equal(durationText(5 * 60000), '5m');
  assert.equal(durationText(3 * 3600000 + 5 * 60000), '3h 5m');
  assert.equal(durationText(2 * 86400000 + 3 * 3600000), '2d 3h');
  assert.equal(durationText(-2 * 86400000), '2d 0h', 'the sign is the caller\'s to show');
});
