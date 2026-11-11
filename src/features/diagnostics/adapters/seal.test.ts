import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IV_BYTES, KEY_BYTES } from '../constants.ts';
import { SEALED_FIELD } from '../keys.ts';
import { createSealer, sealReport } from './seal.ts';
import { newSealKeyPair, openSealed } from './seal.fixture.ts';

test('a report sealed to a public key opens only with that key pair', () => {
  const pair = newSealKeyPair('abc');
  const sealed = createSealer()({ kid: pair.kid, key: pair.publicKey }, '{"message":"hello"}');
  assert.deepEqual(Object.keys(sealed).sort(), ['c', 'e', 'k', 'n']);
  assert.equal(sealed[SEALED_FIELD.kid], 'abc');
  assert.equal(openSealed(sealed, pair.privateKey), '{"message":"hello"}');
  assert.throws(() => openSealed(sealed, newSealKeyPair().privateKey), 'another private key does not open it');
  const again = createSealer()({ kid: pair.kid, key: pair.publicKey }, '{"message":"hello"}');
  assert.notEqual(again[SEALED_FIELD.ciphertext], sealed[SEALED_FIELD.ciphertext], 'a fresh ephemeral key and IV every time');
});

test('the same randomness seals to the same bytes, and a changed body is refused', () => {
  const pair = newSealKeyPair();
  const ephemeralSecret = Buffer.alloc(KEY_BYTES, 7);
  const iv = Buffer.alloc(IV_BYTES, 9);
  const first = sealReport({ kid: pair.kid, key: pair.publicKey }, 'same', ephemeralSecret, iv);
  assert.deepEqual(sealReport({ kid: pair.kid, key: pair.publicKey }, 'same', ephemeralSecret, iv), first);
  const bytes = Buffer.from(first[SEALED_FIELD.ciphertext], 'base64');
  bytes[0] = (bytes[0] ?? 0) ^ 0xff;
  assert.throws(() => openSealed({ ...first, [SEALED_FIELD.ciphertext]: bytes.toString('base64') }, pair.privateKey), 'the tag does not match');
});
