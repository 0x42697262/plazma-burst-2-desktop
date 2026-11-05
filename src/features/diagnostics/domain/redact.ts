import { BEARER, HOME_PATH, IPV4, IPV6, MD5_DIGEST, REPLACEMENT, SECRET_PAIR } from '../keys.ts';

export const redactText = (text: string): string => text
  .replace(SECRET_PAIR, REPLACEMENT.secret)
  .replace(BEARER, REPLACEMENT.secret)
  .replace(MD5_DIGEST, REPLACEMENT.digest)
  .replace(HOME_PATH, REPLACEMENT.path)
  .replace(IPV4, REPLACEMENT.address)
  .replace(IPV6, REPLACEMENT.address);
