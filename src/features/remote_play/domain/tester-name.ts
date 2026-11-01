import { TESTER_NAME_PATTERN } from '../keys.ts';
import { TEXT } from '../text.ts';

export function checkTesterName(name: unknown): string {
  const lowered = (typeof name === 'string' ? name : '').toLowerCase();
  if (!TESTER_NAME_PATTERN.test(lowered)) throw new Error(TEXT.badTesterName);
  return lowered;
}
