import { HOME_PATH, REPLACEMENT } from '../keys.ts';

export const redactText = (text: string): string => text
  .replace(HOME_PATH, REPLACEMENT.path);
