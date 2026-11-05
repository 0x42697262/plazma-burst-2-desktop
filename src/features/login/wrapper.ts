import path from 'node:path';
import type { Logger } from '#kernel/log/logger.ts';
import type { Credentials as EnvironmentCredentials } from '#kernel/config/environment.ts';
import { CLIENT_DETAILS } from '#shared/clients/keys.ts';
import { CLIENT, type ClientId } from '#shared/features/keys.ts';
import { CREDENTIALS_FILE_NAME, OFFICIAL_LOGIN_URL, SADBURST_CREDENTIALS_FILE_NAME } from './keys.ts';
import { TEXT } from './text.ts';
import { mergeCredentials, withPasswordCookie, type Credentials } from './domain/credentials.ts';
import { createAccountBook, type AccountBook } from './services/account-book.ts';
import { officialSiteLogin, sadburstLogin, type Fetcher, type OpenSiteWindow } from './services/new-login.ts';
import { tokenScript } from './domain/token-script.ts';
import { PLAIN_KEYCHAIN, type Keychain } from './adapters/keychain.ts';
import { applyLogin, type CookieStore } from './adapters/cookies.ts';

export type LoginDeps = { log: Logger; dataDir: string; host: string; fromEnvironment: EnvironmentCredentials; isOn: boolean; keychain?: Keychain; canUseAccounts?: boolean; canUseSite?: boolean; openSiteWindow?: OpenSiteWindow; fetcher?: Fetcher; onOfficialSignOut?: () => Promise<void> };
export type TypedLogin = Readonly<{ login?: unknown; password?: unknown }>;

export function createLogin({ log, dataDir, host, fromEnvironment, isOn, keychain = PLAIN_KEYCHAIN, canUseAccounts = true, canUseSite = true, openSiteWindow, fetcher, onOfficialSignOut }: LoginDeps) {
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
  const sadburstBook = bookFor(SADBURST_CREDENTIALS_FILE_NAME);
  let loggingIn = false;
  let startupDone = false;

  function bookOf(client: unknown): AccountBook {
    if (client === CLIENT.official) return officialBook;
    if (client === CLIENT.sadburst) return sadburstBook;
    throw new Error(TEXT.unknownClient(String(client)));
  }

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

  function identity(client: ClientId = CLIENT.official): { login: string | null; cookies: { login: string | null; password: string | null; pb2uid: string | null } } {
    if (!isOn) return { login: null, cookies: { login: null, password: null, pb2uid: null } };
    if (client === CLIENT.sadburst) {
      const active = sadburstBook.activeSecrets();
      return { login: active.login ?? null, cookies: { login: null, password: null, pb2uid: null } };
    }
    const merged = mergeCredentials(officialBook.activeSecrets(), fromEnvironment);
    return { login: merged.login ?? null, cookies: { login: merged.login ?? null, password: merged.password ?? null, pb2uid: merged.pb2uid ?? null } };
  }

  async function logInNew(client: ClientId, typed: TypedLogin): Promise<string | null> {
    if (client === CLIENT.official) {
      if (!openSiteWindow) throw new Error(TEXT.noSite);
      const found = await officialSiteLogin(openSiteWindow, OFFICIAL_LOGIN_URL);
      if (!found) return null;
      const { login, ...secrets } = found;
      officialBook.add(login, secrets);
      return login;
    }
    if (!fetcher) throw new Error(TEXT.noSite);
    const { login, token } = await sadburstLogin(fetcher, CLIENT_DETAILS.sadburst.site, typed.login, typed.password);
    sadburstBook.add(login, { token });
    return login;
  }

  const accounts = isOn && canUseAccounts ? Object.freeze({
    list: (client: unknown) => ({
      accounts: bookOf(client).list(),
      canLogIn: canUseSite,
      overridden: client === CLIENT.official && Object.keys(fromEnvironment).length > 0,
    }),
    use(client: unknown, login: string): void { bookOf(client).use(login); },
    async remove(client: unknown, login: string): Promise<void> {
      bookOf(client).remove(login);
      if (client === CLIENT.official && officialBook.takeSignOut()) await onOfficialSignOut?.();
    },
    async logIn(client: unknown, typed: TypedLogin = {}): Promise<string | null> {
      bookOf(client);
      if (!canUseSite) throw new Error(TEXT.noSite);
      if (loggingIn) throw new Error(TEXT.alreadyLoggingIn);
      loggingIn = true;
      try {
        const login = await logInNew(client as ClientId, typed);
        if (login !== null) log.info(TEXT.saved(login));
        return login;
      } finally {
        loggingIn = false;
      }
    },
  }) : null;

  function sadburstStartupScript(): string | null {
    if (!isOn || !canUseAccounts || startupDone) return null;
    startupDone = true;
    const { token } = sadburstBook.activeSecrets();
    if (token) return tokenScript(token);
    return sadburstBook.takeSignOut() ? tokenScript(null) : null;
  }

  return Object.freeze({ applyCredentials, applyQuietly, hasCredentials, identity, accounts, sadburstStartupScript });
}
