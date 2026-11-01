export { SITE, COOKIE_DOMAIN, COOKIE_PATH, cookieUrl, siteUrl } from '#shared/site/keys.ts';
export const CREDENTIAL_KEYS = Object.freeze(['login', 'password', 'pb2uid'] as const);
export type CredentialKey = typeof CREDENTIAL_KEYS[number];
export const CREDENTIALS_FILE_NAME = 'credentials.json';
