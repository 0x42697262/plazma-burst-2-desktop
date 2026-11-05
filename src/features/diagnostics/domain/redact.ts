import { BEARER, HOME_PATH, MD5_DIGEST, REPLACEMENT, SECRET_PAIR } from '../keys.ts';

export const redactText = (text: string): string => text
  .replace(SECRET_PAIR, REPLACEMENT.secret)
  .replace(BEARER, REPLACEMENT.secret)
  .replace(MD5_DIGEST, REPLACEMENT.digest)
  .replace(HOME_PATH, REPLACEMENT.path);
