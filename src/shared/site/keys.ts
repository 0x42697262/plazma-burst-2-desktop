export const SITE = 'plazmaburst2.com';
export const LEADING_DOT = /^\./;
export const COOKIE_DOMAIN = `.${SITE}`;
export const COOKIE_PATH = '/';
export const cookieUrl = (secure: boolean, domain: string, cookiePath: string): string => `http${secure ? 's' : ''}://${domain.replace(LEADING_DOT, '')}${cookiePath}`;
export const siteUrl = (host: string): string => `https://${host}/`;
