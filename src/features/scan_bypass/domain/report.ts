import { LOCKED_ARRAY_CODE } from '../keys.ts';
import { SCAN_TEXT } from '../text.ts';

export type LockedArrays = { name(index: number): string | null; count(): string };

export function describeReport(code: string, detail: string, lockedArrays: LockedArrays): string {
  const what = SCAN_TEXT.codes[code] ?? SCAN_TEXT.unknownCode;
  if (code === LOCKED_ARRAY_CODE) return SCAN_TEXT.lockedArray(code, what, detail, lockedArrays.count(), lockedArrays.name(Number(detail)));
  return SCAN_TEXT.other(code, what, detail);
}
