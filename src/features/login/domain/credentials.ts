import crypto from 'node:crypto';
import { CREDENTIAL_KEYS, HASH_ENCODING, PASSWORD_COOKIE, PASSWORD_HASH, TEXT_FOR_HASH, type CredentialKey } from '../keys.ts';

export type Credentials = Partial<Record<CredentialKey, string>>;

const textOf = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
};

export function mergeCredentials(saved: Readonly<Record<string, unknown>>, fromEnvironment: Readonly<Record<string, unknown>>): Credentials {
  const merged: Credentials = {};
  for (const key of CREDENTIAL_KEYS) {
    const value = textOf(fromEnvironment[key] ?? saved[key]);
    if (value !== null) merged[key] = value;
  }
  return merged;
}

export const passwordCookie = (password: string): string => (PASSWORD_COOKIE.test(password) ? password : crypto.createHash(PASSWORD_HASH).update(password, TEXT_FOR_HASH).digest(HASH_ENCODING));

export const withPasswordCookie = (credentials: Credentials): Credentials => (credentials.password ? { ...credentials, password: passwordCookie(credentials.password) } : credentials);
