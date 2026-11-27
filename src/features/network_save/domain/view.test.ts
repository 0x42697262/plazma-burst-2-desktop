import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diffSaves, hiddenText, rowsOf, shownValue } from './view.ts';

test('rows are sorted by name and the login proof is never shown', () => {
  const values = new Map([['volume', '0.5'], ['first_login_proof', 'secret-proof'], ['first_uid', 'abc12.def34.ghi56.jkl78']]);
  assert.deepEqual(rowsOf(values), [['first_login_proof', '‹hidden›'], ['first_uid', 'abc12.def34.ghi56.jkl78'], ['volume', '0.5']]);
  assert.equal(shownValue('first_login_proof', 'x'), '‹hidden›');
  assert.equal(shownValue('volume', ''), '""');
});

test('the raw text keeps everything but the proof', () => {
  assert.equal(hiddenText('volume=1;first_login_proof=secret-proof;first_uid=a.b.c.d;'), 'volume=1;first_login_proof=‹hidden›;first_uid=a.b.c.d;');
  assert.equal(hiddenText('first_login_proof=secret^1still^2secret;x=1;'), 'first_login_proof=‹hidden›;x=1;');
});

test('a diff lists what only one side has and what differs, the proof only as differs or not', () => {
  const local = new Map([['a', '1'], ['b', '2'], ['first_login_proof', 'one'], ['only_local', 'x']]);
  const online = new Map([['a', '1'], ['b', '3'], ['first_login_proof', 'two'], ['only_online', 'y']]);
  assert.deepEqual(diffSaves(local, online), {
    same: 1,
    changed: [['b', '2', '3'], ['first_login_proof', '‹hidden›', '‹hidden›']],
    onlyLocal: [['only_local', 'x']],
    onlyOnline: [['only_online', 'y']],
  });
});
