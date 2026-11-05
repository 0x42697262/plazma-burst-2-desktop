import { PLAIN_BACKEND, SECRET_ENCODING } from '../keys.ts';

export type Keychain = {
  canEncrypt(): boolean;
  seal(text: string): string;
  open(secret: string): string;
};

export type SafeStorageLike = {
  isEncryptionAvailable(): boolean;
  getSelectedStorageBackend?(): string;
  encryptString(text: string): Buffer;
  decryptString(encrypted: Buffer): string;
};

export const PLAIN_KEYCHAIN: Keychain = Object.freeze({ canEncrypt: () => false, seal: (text) => text, open: (secret) => secret });

export const electronKeychain = (storage: SafeStorageLike): Keychain => Object.freeze({
  canEncrypt: () => storage.isEncryptionAvailable() && storage.getSelectedStorageBackend?.() !== PLAIN_BACKEND,
  seal: (text) => storage.encryptString(text).toString(SECRET_ENCODING),
  open: (secret) => storage.decryptString(Buffer.from(secret, SECRET_ENCODING)),
});
