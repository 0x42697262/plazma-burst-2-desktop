export const SITE = 'plazmaburst2.com';
export const CREDENTIAL_KEYS = Object.freeze(['login', 'password', 'pb2uid'] as const);
export type CredentialKey = typeof CREDENTIAL_KEYS[number];
export const LEADING_DOT = /^\./;
export const cookieUrl = (secure: boolean, domain: string, cookiePath: string): string => `http${secure ? 's' : ''}://${domain.replace(LEADING_DOT, '')}${cookiePath}`;
export const siteUrl = (host: string): string => `https://${host}/`;
export const COOKIE_DOMAIN = `.${SITE}`;
export const COOKIE_PATH = '/';
export const CREDENTIALS_FILE_NAME = 'credentials.json';
