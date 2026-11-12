import fs from 'node:fs/promises';
import { z } from 'zod';
import { createVersionedFile } from '#kernel/persist/versioned.ts';
import { COOKIE_PATH, SITE, cookieUrl, siteCookiesIn, type EveryCookie } from '#shared/site/keys.ts';
import { OFFICIAL_LOGIN_FILE_MODE, OFFICIAL_LOGIN_FILE_VERSION } from './constants.ts';

const storedCookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string(),
  path: z.string(),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  hostOnly: z.boolean(),
  expirationDate: z.number().optional(),
});
const officialLoginSchema = z.object({ cookies: z.array(storedCookieSchema) });
type StoredCookie = z.infer<typeof storedCookieSchema>;

export type SiteCookie = Partial<StoredCookie> & { name: string; value?: string };
export type SiteCookieStore = {
  get(filter: EveryCookie): Promise<SiteCookie[]>;
  remove(url: string, name: string): Promise<void>;
  set(details: { url: string; name: string; value: string; domain?: string; path: string; secure: boolean; httpOnly: boolean; expirationDate?: number }): Promise<void>;
  flushStore(): Promise<void>;
};

const stored = (cookie: SiteCookie): StoredCookie => ({
  name: cookie.name,
  value: cookie.value ?? '',
  domain: cookie.domain ?? SITE,
  path: cookie.path ?? COOKIE_PATH,
  secure: cookie.secure ?? false,
  httpOnly: cookie.httpOnly ?? false,
  hostOnly: cookie.hostOnly ?? false,
  ...(cookie.expirationDate === undefined ? {} : { expirationDate: cookie.expirationDate }),
});

export function createSiteCookies(cookies: SiteCookieStore, stashFile: string) {
  const stash = createVersionedFile({ file: stashFile, version: OFFICIAL_LOGIN_FILE_VERSION, schema: officialLoginSchema, migrations: {}, fileMode: OFFICIAL_LOGIN_FILE_MODE });

  async function clear(): Promise<string[]> {
    const site = await siteCookiesIn(cookies);
    for (const cookie of site) await cookies.remove(cookieUrl(!!cookie.secure, cookie.domain ?? SITE, cookie.path ?? COOKIE_PATH), cookie.name);
    return site.map((cookie) => cookie.name);
  }

  async function hideForPrivateServer(): Promise<string[]> {
    const current = await siteCookiesIn(cookies);
    const alreadyHidden = (await stash.read()) !== null;
    if (!alreadyHidden && current.length) await stash.write({ cookies: current.map(stored) });
    const removed = await clear();
    await cookies.flushStore();
    return removed;
  }

  async function restoreOfficial(): Promise<string[]> {
    const hidden = await stash.read();
    if (!hidden) return [];
    await clear();
    for (const cookie of hidden.value.cookies) {
      await cookies.set({
        url: cookieUrl(cookie.secure, cookie.domain, cookie.path),
        name: cookie.name,
        value: cookie.value,
        ...(cookie.hostOnly ? {} : { domain: cookie.domain }),
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        ...(cookie.expirationDate === undefined ? {} : { expirationDate: cookie.expirationDate }),
      });
    }
    await cookies.flushStore();
    await forget();
    return hidden.value.cookies.map((cookie) => cookie.name);
  }

  async function forget(): Promise<void> {
    await fs.rm(stashFile, { force: true });
  }

  return Object.freeze({ hideForPrivateServer, restoreOfficial, forget });
}
