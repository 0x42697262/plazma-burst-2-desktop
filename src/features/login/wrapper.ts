import path from 'node:path';
import type { Logger } from '#kernel/log/logger.ts';
import type { Credentials as EnvironmentCredentials } from '#kernel/config/environment.ts';
import { CREDENTIALS_FILE_NAME } from './keys.ts';
import { TEXT } from './text.ts';
import { mergeCredentials, withPasswordCookie, type Credentials } from './domain/credentials.ts';
import { createAccountBook } from './services/account-book.ts';
import { PLAIN_KEYCHAIN, type Keychain } from './adapters/keychain.ts';
import { applyLogin, type CookieStore } from './adapters/cookies.ts';

export type LoginDeps = { log: Logger; dataDir: string; host: string; fromEnvironment: EnvironmentCredentials; isOn: boolean; keychain?: Keychain };

export function createLogin({ log, dataDir, host, fromEnvironment, isOn, keychain = PLAIN_KEYCHAIN }: LoginDeps) {
  const bookFor = (name: string) => {
    const file = path.join(dataDir, name);
    return createAccountBook({
      file,
      keychain,
      now: () => new Date().toISOString(),
      reportUnreadable: (message) => { log.error(TEXT.unreadable(file, message)); },
      warn: (message) => { log.warn(message); },
    });
  };
  const officialBook = bookFor(CREDENTIALS_FILE_NAME);

  const credentials = (): Credentials => (isOn ? withPasswordCookie(mergeCredentials(officialBook.activeSecrets(), fromEnvironment)) : {});

  async function applyCredentials(cookies: CookieStore): Promise<void> {
    const { removed, set } = await applyLogin(cookies, credentials(), host);
    if (removed.length) log.info(TEXT.cleared(removed));
    if (set.length) log.info(TEXT.loggedIn(set));
    else log.info(isOn ? TEXT.loggedOut : TEXT.loginOff);
  }

  async function applyQuietly(cookies: CookieStore): Promise<void> {
    await applyLogin(cookies, credentials(), host);
  }

  const hasCredentials = (): boolean => Object.keys(credentials()).length > 0;

  return Object.freeze({ applyCredentials, applyQuietly, hasCredentials });
}
