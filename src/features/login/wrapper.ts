import path from 'node:path';
import type { Logger } from '#kernel/log/logger.ts';
import type { Credentials as EnvironmentCredentials } from '#kernel/config/environment.ts';
import { CREDENTIALS_FILE_NAME } from './keys.ts';
import { TEXT } from './text.ts';
import { mergeCredentials, type Credentials } from './domain/credentials.ts';
import { readCredentialsFile } from './adapters/credentials-file.ts';
import { applyLogin, type CookieStore } from './adapters/cookies.ts';

export type LoginDeps = { log: Logger; dataDir: string; host: string; fromEnvironment: EnvironmentCredentials; isOn: boolean };

export function createLogin({ log, dataDir, host, fromEnvironment, isOn }: LoginDeps) {
  const file = path.join(dataDir, CREDENTIALS_FILE_NAME);

  const credentials = (): Credentials => (isOn ? mergeCredentials(readCredentialsFile(file, (message) => { log.error(TEXT.unreadable(file, message)); }), fromEnvironment) : {});

  async function applyCredentials(cookies: CookieStore): Promise<void> {
    const { removed, set } = await applyLogin(cookies, credentials(), host);
    if (removed.length) log.info(TEXT.cleared(removed));
    if (set.length) log.info(TEXT.loggedIn(set));
    else log.info(isOn ? TEXT.loggedOut : TEXT.loginOff);
  }

  async function applyQuietly(cookies: CookieStore): Promise<void> {
    await applyLogin(cookies, credentials(), host);
  }

  async function startLoggedOut(cookies: CookieStore): Promise<void> {
    const { removed } = await applyLogin(cookies, {}, host);
    if (removed.length) log.info(TEXT.clearedPrivate(removed));
  }

  return Object.freeze({ applyCredentials, applyQuietly, startLoggedOut });
}
