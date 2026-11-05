import { z } from 'zod';
import { LEGACY_FIELD } from '../keys.ts';

const accountSchema = z.object({ login: z.string(), secret: z.string(), encrypted: z.boolean(), updatedAt: z.string() });
export const accountsSchema = z.object({ active: z.string().nullable(), accounts: z.record(z.string(), accountSchema), signOut: z.boolean() });

export type StoredAccount = z.infer<typeof accountSchema>;
export type AccountsData = z.infer<typeof accountsSchema>;
export type Secrets = Readonly<Record<string, string>>;
export type ShownAccount = Readonly<{ login: string; active: boolean; updatedAt: string }>;

export const NO_ACCOUNTS: AccountsData = Object.freeze({ active: null, accounts: {}, signOut: false });

const legacyText = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

export function fromLegacyFile(data: Record<string, unknown>): Record<string, unknown> {
  const login = legacyText(data[LEGACY_FIELD.login]);
  const password = legacyText(data[LEGACY_FIELD.password]);
  const pb2uid = legacyText(data[LEGACY_FIELD.pb2uid]);
  if (!login && !password && !pb2uid) return { ...NO_ACCOUNTS };
  const secret = JSON.stringify({ ...(password ? { password } : {}), ...(pb2uid ? { pb2uid } : {}) });
  return { active: login, accounts: { [login]: { login, secret, encrypted: false, updatedAt: '' } }, signOut: false };
}

export const withAccount = (data: AccountsData, account: StoredAccount): AccountsData => ({
  active: account.login,
  accounts: { ...data.accounts, [account.login]: account },
  signOut: false,
});

export const withActive = (data: AccountsData, login: string): AccountsData => ({ ...data, active: login, signOut: false });

export function withoutAccount(data: AccountsData, login: string): AccountsData {
  const { [login]: _removed, ...accounts } = data.accounts;
  const wasActive = data.active === login;
  return { active: wasActive ? null : data.active, accounts, signOut: data.signOut || wasActive };
}

export const shownAccounts = (data: AccountsData): ShownAccount[] => Object.values(data.accounts)
  .map(({ login, updatedAt }) => ({ login, active: login === data.active, updatedAt }))
  .sort((first, second) => first.login.localeCompare(second.login));

export const hasAccount = (data: AccountsData, login: string): boolean => Object.hasOwn(data.accounts, login);
