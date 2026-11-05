import { createVersionedFile } from '#kernel/persist/versioned.ts';
import { ACCOUNTS_FILE_MODE, ACCOUNTS_FILE_VERSION } from '../constants.ts';
import { TEXT } from '../text.ts';
import { NO_ACCOUNTS, accountsSchema, fromLegacyFile, hasAccount, shownAccounts, withAccount, withActive, withoutAccount, type AccountsData, type Secrets, type ShownAccount, type StoredAccount } from '../domain/accounts.ts';
import type { Keychain } from '../adapters/keychain.ts';

export type AccountBookDeps = {
  file: string;
  keychain: Keychain;
  now: () => string;
  reportUnreadable: (message: string) => void;
  warn: (message: string) => void;
};

export type AccountBook = {
  list(): ShownAccount[];
  add(login: string, secrets: Secrets): void;
  use(login: string): void;
  remove(login: string): void;
  activeSecrets(): Record<string, string>;
  takeSignOut(): boolean;
};

export function createAccountBook({ file, keychain, now, reportUnreadable, warn }: AccountBookDeps): AccountBook {
  const store = createVersionedFile({ file, version: ACCOUNTS_FILE_VERSION, schema: accountsSchema, migrations: { 0: fromLegacyFile }, fileMode: ACCOUNTS_FILE_MODE });
  let warnedPlain = false;

  function read(): AccountsData {
    try {
      const data = store.readSync()?.value ?? NO_ACCOUNTS;
      const needsSealing = keychain.canEncrypt() && Object.values(data.accounts).some((account) => !account.encrypted);
      if (needsSealing) write(data);
      return needsSealing ? store.readSync()?.value ?? NO_ACCOUNTS : data;
    } catch (error) {
      reportUnreadable((error as Error).message);
      return NO_ACCOUNTS;
    }
  }

  function sealed(account: StoredAccount): StoredAccount {
    if (account.encrypted || !keychain.canEncrypt()) return account;
    return { ...account, secret: keychain.seal(account.secret), encrypted: true };
  }

  function write(data: AccountsData): void {
    if (!keychain.canEncrypt() && !warnedPlain) {
      warnedPlain = true;
      warn(TEXT.notEncrypted);
    }
    store.writeSync({ ...data, accounts: Object.fromEntries(Object.entries(data.accounts).map(([login, account]) => [login, sealed(account)])) });
  }

  function requireAccount(data: AccountsData, login: string): void {
    if (!hasAccount(data, login)) throw new Error(TEXT.noAccount(login));
  }

  return {
    list: () => shownAccounts(read()),
    add(login, secrets) {
      write(withAccount(read(), { login, secret: JSON.stringify(secrets), encrypted: false, updatedAt: now() }));
    },
    use(login) {
      const data = read();
      requireAccount(data, login);
      write(withActive(data, login));
    },
    remove(login) {
      const data = read();
      requireAccount(data, login);
      write(withoutAccount(data, login));
    },
    activeSecrets() {
      const data = read();
      const account = data.active === null ? undefined : data.accounts[data.active];
      if (!account) return {};
      try {
        const secrets = JSON.parse(account.encrypted ? keychain.open(account.secret) : account.secret) as Record<string, string>;
        return { login: account.login, ...secrets };
      } catch {
        warn(TEXT.cannotOpen(account.login));
        return {};
      }
    },
    takeSignOut() {
      const data = read();
      if (!data.signOut) return false;
      write({ ...data, signOut: false });
      return true;
    },
  };
}
