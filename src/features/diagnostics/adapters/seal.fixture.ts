import crypto from 'node:crypto';
import { AUTH_TAG_BYTES } from '../constants.ts';
import type { SealedReport } from '../domain/config.ts';
import { CIPHER, ENCODING, KEY_FORMAT, SEALED_FIELD } from '../keys.ts';
import { privateKeyOf, publicKeyOf, rawPrivateOf, rawPublicOf, sharedKeyOf } from './seal.ts';

export type SealKeyPair = Readonly<{ kid: string; publicKey: Buffer; privateKey: Buffer }>;

export function newSealKeyPair(kid = 'test'): SealKeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync(KEY_FORMAT.x25519);
  return Object.freeze({ kid, publicKey: rawPublicOf(publicKey), privateKey: rawPrivateOf(privateKey) });
}

export function openSealed(sealed: SealedReport, privateKey: Buffer): string {
  const ephemeral = publicKeyOf(Buffer.from(sealed[SEALED_FIELD.ephemeral], ENCODING.base64));
  const shared = crypto.diffieHellman({ privateKey: privateKeyOf(privateKey), publicKey: ephemeral });
  const ciphertext = Buffer.from(sealed[SEALED_FIELD.ciphertext], ENCODING.base64);
  const decipher = crypto.createDecipheriv(CIPHER, sharedKeyOf(shared), Buffer.from(sealed[SEALED_FIELD.iv], ENCODING.base64));
  decipher.setAuthTag(ciphertext.subarray(-AUTH_TAG_BYTES));
  return Buffer.concat([decipher.update(ciphertext.subarray(0, -AUTH_TAG_BYTES)), decipher.final()]).toString(ENCODING.utf8);
}
