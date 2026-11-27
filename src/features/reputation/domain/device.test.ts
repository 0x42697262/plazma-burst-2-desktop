import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceOfSave, idShape, originOf, saveValuesOf } from './device.ts';

const GAME_ID = 'abc12.def34.ghi56.jkl78';

test('the network save text is read the way the game writes it, ^1 and ^2 included', () => {
  const text = `volume=0.5;first_uid=${GAME_ID};first_login=player^2one;first_login_proof=abc;odd^1name=1;`;
  assert.deepEqual(saveValuesOf(text), { uid: GAME_ID, firstLogin: 'player=one', hasProof: true });
  assert.deepEqual(saveValuesOf('volume=1;'), { uid: null, firstLogin: null, hasProof: false });
  assert.deepEqual(saveValuesOf('x'), { uid: null, firstLogin: null, hasProof: false }, 'the "nothing to load" answers');
});

test('the local save is the game\'s JSON in localStorage', () => {
  assert.deepEqual(deviceOfSave(JSON.stringify({ first_uid: GAME_ID, first_login: 'player-one', first_login_proof: 'p' })), { uid: GAME_ID, firstLogin: 'player-one', hasProof: true });
  assert.deepEqual(deviceOfSave(null), { uid: null, firstLogin: null, hasProof: false });
  assert.deepEqual(deviceOfSave('{broken'), { uid: null, firstLogin: null, hasProof: false });
});

test('the shape tells whether this game version made the id', () => {
  assert.equal(idShape(GAME_ID), 'game');
  assert.equal(idShape('l0.123456789'), 'other');
  assert.equal(idShape(null), 'none');
});

test('the origin comes from what the network save carried at start and what was uploaded since', () => {
  const load = (uid: string | null) => ({ at: 1000, login: 'player-one', uid, firstLogin: null, hasProof: false });
  const upload = (uid: string | null) => ({ at: 2000, login: 'player-two', uid, firstLogin: null, hasProof: false });
  assert.deepEqual(originOf(GAME_ID, [], []), { kind: 'notSeen', load: null, upload: null });
  assert.deepEqual(originOf(GAME_ID, [load(GAME_ID)], []), { kind: 'fromNetworkSave', load: load(GAME_ID), upload: null });
  assert.deepEqual(originOf(GAME_ID, [load(null)], []), { kind: 'keptLocal', load: load(null), upload: null });
  assert.deepEqual(originOf(GAME_ID, [load('other.id.from.there')], []), { kind: 'differs', load: load('other.id.from.there'), upload: null });
  assert.deepEqual(originOf(GAME_ID, [load(null), load(GAME_ID)], [upload(GAME_ID)]).upload, upload(GAME_ID), 'the latest of each');
});
