import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectMapPieces, isNotPublished, privateMatchPreset, replyOf } from './lobby.ts';

test('map bot: the match it creates is private, unranked, for two, on the lobby\'s servers', () => {
  const preset = privateMatchPreset('wanted2001-saw', 'secret', 'ab12c');
  assert.equal(preset.map_id, 'wanted2001-saw');
  assert.equal(preset.password, 'secret');
  assert.equal(preset.ranked, false);
  assert.equal(preset.p2p, false);
  assert.equal(preset.max_players, 2);
  assert.equal(preset.title, 'map ab12c');
});

test('map bot: map pieces are put together in order once all are there', () => {
  const pieces = collectMapPieces();
  assert.equal(pieces.complete(), null);
  pieces.add(1, 2, 'world');
  assert.equal(pieces.complete(), null);
  pieces.add(0, 2, 'hello ');
  assert.equal(pieces.complete(), 'hello world');
});

test('map bot: "not published" is told apart from other refusals', () => {
  assert.ok(isNotPublished(replyOf(['fail', 'Match creation error: Map is not published']).detail), 'the official lobby\'s words');
  assert.ok(isNotPublished('Map "x" does not exist (not on this server, and not published)'), 'this repository\'s server');
  assert.ok(!isNotPublished('Match creation error: Too fast'));
  assert.deepEqual(replyOf(['ok', '']), { ok: true, detail: '' });
});
