import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSaveText, deviceOfSave, saveValuesOf } from './save-text.ts';

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

test('every value of the save text is decoded, the last of a repeated name wins', () => {
  assert.deepEqual([...decodeSaveText('a=1;b=x^1y;a=2;=skipped;novalue;')], [['a', '2'], ['b', 'x;y']]);
});
