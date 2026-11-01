import { COOKIE_LIFETIME_S, MILLISECONDS_PER_SECOND } from '../constants.ts';
import { COOKIE_DOMAIN, COOKIE_PATH, SITE, cookieUrl, siteUrl } from '../keys.ts';
import type { Credentials } from '../domain/credentials.ts';

export type Cookie = { name: string; domain?: string; path?: string; secure?: boolean };
export type CookieStore = {
  get(filter: { domain: string }): Promise<Cookie[]>;
  remove(url: string, name: string): Promise<void>;
  set(cookie: { url: string; domain: string; path: string; name: string; value: string; secure: boolean; expirationDate: number }): Promise<void>;
  flushStore(): Promise<void>;
};
export type LoginResult = { removed: string[]; set: string[] };

async function clearSiteCookies(cookies: CookieStore): Promise<string[]> {
  const site = await cookies.get({ domain: SITE });
  for (const cookie of site) await cookies.remove(cookieUrl(!!cookie.secure, cookie.domain ?? '', cookie.path ?? COOKIE_PATH), cookie.name);
  return site.map((cookie) => cookie.name);
}

export async function applyLogin(cookies: CookieStore, credentials: Credentials, host: string, now: () => number = () => Date.now()): Promise<LoginResult> {
  const removed = await clearSiteCookies(cookies);
  const expirationDate = Math.floor(now() / MILLISECONDS_PER_SECOND) + COOKIE_LIFETIME_S;
  for (const [name, value] of Object.entries(credentials)) {
    await cookies.set({ url: siteUrl(host), domain: COOKIE_DOMAIN, path: COOKIE_PATH, name, value, secure: true, expirationDate });
  }
  await cookies.flushStore();
  return { removed, set: Object.keys(credentials) };
}
