import crypto from 'node:crypto';
import { IV_BYTES, KEY_BYTES } from '../constants.ts';
import type { DiagnosticKey, SealedReport } from '../domain/config.ts';
import { CIPHER, DER_PREFIX, ENCODING, HKDF_HASH, KDF_INFO, KEY_FORMAT, SEALED_FIELD } from '../keys.ts';

export type RandomBytes = (length: number) => Buffer;
export type Sealer = (recipient: DiagnosticKey, text: string) => SealedReport;

const EMPTY_SALT = Buffer.alloc(0);
const prefixOf = (hex: string): Buffer => Buffer.from(hex, ENCODING.hex);
const joined = (hex: string, bytes: Buffer): Buffer => Buffer.concat([prefixOf(hex), bytes]);
const trailing = (der: Buffer): Buffer => der.subarray(-KEY_BYTES);

export const privateKeyOf = (bytes: Buffer): crypto.KeyObject => crypto.createPrivateKey({ key: joined(DER_PREFIX.privateKey, bytes), format: KEY_FORMAT.der, type: KEY_FORMAT.pkcs8 });
export const publicKeyOf = (bytes: Buffer): crypto.KeyObject => crypto.createPublicKey({ key: joined(DER_PREFIX.publicKey, bytes), format: KEY_FORMAT.der, type: KEY_FORMAT.spki });
export const rawPrivateOf = (key: crypto.KeyObject): Buffer => trailing(key.export({ format: KEY_FORMAT.der, type: KEY_FORMAT.pkcs8 }));
export const rawPublicOf = (key: crypto.KeyObject): Buffer => trailing(key.export({ format: KEY_FORMAT.der, type: KEY_FORMAT.spki }));

export const sharedKeyOf = (shared: Buffer): Buffer => Buffer.from(crypto.hkdfSync(HKDF_HASH, shared, EMPTY_SALT, KDF_INFO, KEY_BYTES));

export function sealReport(recipient: DiagnosticKey, text: string, ephemeralSecret: Buffer, iv: Buffer): SealedReport {
  const ephemeral = privateKeyOf(ephemeralSecret);
  const shared = crypto.diffieHellman({ privateKey: ephemeral, publicKey: publicKeyOf(recipient.key) });
  const cipher = crypto.createCipheriv(CIPHER, sharedKeyOf(shared), iv);
  const ciphertext = Buffer.concat([cipher.update(text, ENCODING.utf8), cipher.final(), cipher.getAuthTag()]);
  const sealed: SealedReport = {
    [SEALED_FIELD.kid]: recipient.kid,
    [SEALED_FIELD.ephemeral]: rawPublicOf(crypto.createPublicKey(ephemeral)).toString(ENCODING.base64),
    [SEALED_FIELD.iv]: iv.toString(ENCODING.base64),
    [SEALED_FIELD.ciphertext]: ciphertext.toString(ENCODING.base64),
  };
  return Object.freeze(sealed);
}

export const createSealer = (random: RandomBytes = crypto.randomBytes): Sealer => (recipient, text) => sealReport(recipient, text, random(KEY_BYTES), random(IV_BYTES));
