import { HTTP_METHOD } from '#shared/contract/keys.ts';
import { LOGIN_TIMEOUT_MS, SERVER_ERROR_STATUS } from '../constants.ts';
import { COOKIE_NAME, GUEST_LOGIN_PREFIX, JSON_HEADERS, PASSWORD_COOKIE, SADBURST_API, bearerHeaders } from '../keys.ts';
import { TEXT } from '../text.ts';

type SiteCookie = Readonly<{ name: string; value: string }>;
export type SiteWindow = {
  cookies(): Promise<readonly SiteCookie[]>;
  onChange(listener: () => void): void;
  onClosed(listener: () => void): void;
  check(url: string): Promise<number>;
  close(): void;
};
export type OpenSiteWindow = (url: string) => SiteWindow;
export type SiteCredentials = { login: string; password: string; pb2uid?: string };
export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

function credentialsIn(cookies: readonly SiteCookie[]): SiteCredentials | null {
  const valueOf = (name: string): string => cookies.find((cookie) => cookie.name === name)?.value ?? '';
  const login = valueOf(COOKIE_NAME.login);
  const password = valueOf(COOKIE_NAME.password);
  const isSignedIn = login !== '' && !login.startsWith(GUEST_LOGIN_PREFIX) && PASSWORD_COOKIE.test(password);
  if (!isSignedIn) return null;
  const pb2uid = valueOf(COOKIE_NAME.pb2uid);
  return { login, password, ...(pb2uid ? { pb2uid } : {}) };
}

async function confirmedBySite(site: SiteWindow, url: string, found: SiteCredentials): Promise<SiteCredentials> {
  let status: number;
  try {
    status = await site.check(url);
  } catch (error) {
    throw new Error(TEXT.siteUnreachable((error as Error).message), { cause: error });
  }
  if (status >= SERVER_ERROR_STATUS) throw new Error(TEXT.siteError(status));
  const kept = credentialsIn(await site.cookies());
  if (kept?.login !== found.login || kept.password !== found.password) throw new Error(TEXT.siteDropped);
  return kept;
}

export function officialSiteLogin(open: OpenSiteWindow, url: string): Promise<SiteCredentials | null> {
  const site = open(url);
  return new Promise((resolve, reject) => {
    let checking = false;
    let changedAgain = false;
    let finished = false;
    const finish = (action: () => void): void => {
      if (finished) return;
      finished = true;
      action();
      site.close();
    };
    async function lookForLogin(): Promise<void> {
      if (finished) return;
      if (checking) {
        changedAgain = true;
        return;
      }
      checking = true;
      const found = credentialsIn(await site.cookies());
      if (found) {
        await confirmedBySite(site, url, found).then(
          (confirmed) => { finish(() => { resolve(confirmed); }); },
          (error: Error) => { finish(() => { reject(error); }); },
        );
        return;
      }
      checking = false;
      if (changedAgain) {
        changedAgain = false;
        await lookForLogin();
      }
    }
    site.onClosed(() => { finish(() => { resolve(null); }); });
    site.onChange(() => { void lookForLogin(); });
  });
}

type SadburstAnswer = { success?: unknown; login?: unknown; token?: unknown; game_token?: unknown; message?: unknown };

const answerOf = (response: Response): Promise<SadburstAnswer> => response.json().then((answer) => (answer ?? {}) as SadburstAnswer, () => ({}));
const isText = (value: unknown): value is string => typeof value === 'string' && value !== '';

export async function sadburstLogin(fetcher: Fetcher, site: string, login: unknown, password: unknown): Promise<{ login: string; token: string }> {
  const typedLogin = typeof login === 'string' ? login.trim() : '';
  if (!typedLogin || !isText(password)) throw new Error(TEXT.needLoginAndPassword);
  let answer: SadburstAnswer;
  let isOk: boolean;
  try {
    const response = await fetcher(site + SADBURST_API.login, { method: HTTP_METHOD.post, headers: JSON_HEADERS, body: JSON.stringify({ login: typedLogin, password }), signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS) });
    isOk = response.ok;
    answer = await answerOf(response);
  } catch (error) {
    throw new Error(TEXT.sadburstUnreachable((error as Error).message), { cause: error });
  }
  if (!isOk || !answer.success || !isText(answer.login) || !isText(answer.token)) throw new Error(TEXT.sadburstRefused(isText(answer.message) ? answer.message : TEXT.sadburstLoginFailed));
  const { login: accountLogin, token } = answer;
  const confirmed = await fetcher(site + SADBURST_API.session, { method: HTTP_METHOD.get, headers: bearerHeaders(token), signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS) })
    .then(async (response) => (response.ok ? answerOf(response) : null), () => null);
  if (!confirmed?.success || !isText(confirmed.game_token)) throw new Error(TEXT.sadburstNotVerified);
  return { login: accountLogin, token };
}
