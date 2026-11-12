export const SITE = 'plazmaburst2.com';
export const LEADING_DOT = /^\./;
export const COOKIE_DOMAIN = `.${SITE}`;
export const COOKIE_PATH = '/';
export const cookieUrl = (secure: boolean, domain: string, cookiePath: string): string => `http${secure ? 's' : ''}://${domain.replace(LEADING_DOT, '')}${cookiePath}`;
export const siteUrl = (host: string): string => `https://${host}/`;

type DomainCookie = { domain?: string };
export type EveryCookie = Readonly<Record<string, never>>;
const EVERY_COOKIE: EveryCookie = Object.freeze({});
export const isSiteCookie = (cookie: DomainCookie): boolean => {
  const bare = (cookie.domain ?? '').replace(LEADING_DOT, '');
  return bare === SITE || bare.endsWith(COOKIE_DOMAIN);
};
export const siteCookiesIn = async <Found extends DomainCookie>(store: { get(filter: EveryCookie): Promise<Found[]> }): Promise<Found[]> => (await store.get(EVERY_COOKIE)).filter(isSiteCookie);
