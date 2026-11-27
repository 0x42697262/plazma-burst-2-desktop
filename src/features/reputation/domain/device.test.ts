import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idShape, originOf } from './device.ts';

const GAME_ID = 'abc12.def34.ghi56.jkl78';

test('the shape tells whether this game version made the id', () => {
  assert.equal(idShape(GAME_ID), 'game');
  assert.equal(idShape('l0.123456789'), 'other');
  assert.equal(idShape(null), 'none');
});

test('the origin comes from what the network save carried at start and what was uploaded since', () => {
  const load = (uid: string | null) => ({ at: 1000, login: 'player-one', source: 'game' as const, uid, firstLogin: null, hasProof: false });
  const upload = (uid: string | null) => ({ at: 2000, login: 'player-two', source: 'game' as const, uid, firstLogin: null, hasProof: false });
  assert.deepEqual(originOf(GAME_ID, [], []), { kind: 'notSeen', load: null, upload: null });
  assert.deepEqual(originOf(GAME_ID, [load(GAME_ID)], []), { kind: 'fromNetworkSave', load: load(GAME_ID), upload: null });
  assert.deepEqual(originOf(GAME_ID, [load(null)], []), { kind: 'keptLocal', load: load(null), upload: null });
  assert.deepEqual(originOf(GAME_ID, [load('other.id.from.there')], []), { kind: 'differs', load: load('other.id.from.there'), upload: null });
  assert.deepEqual(originOf(GAME_ID, [load(null), load(GAME_ID)], [upload(GAME_ID)]).upload, upload(GAME_ID), 'the latest of each');
});

test('loads and uploads the console made are not where the id came from', () => {
  const console = { at: 3000, login: 'player-one', source: 'console' as const, uid: 'other.id.from.there', firstLogin: null, hasProof: false };
  const game = { at: 1000, login: 'player-one', source: 'game' as const, uid: 'abc12.def34.ghi56.jkl78', firstLogin: null, hasProof: false };
  assert.deepEqual(originOf('abc12.def34.ghi56.jkl78', [game, console], [console]), { kind: 'fromNetworkSave', load: game, upload: null });
});
