import { CREDENTIAL_KEYS, type CredentialKey } from '../keys.ts';

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
