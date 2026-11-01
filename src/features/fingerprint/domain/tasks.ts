import { FIELD, decodeNumber, splitParts, unescField } from '#console/kernel/net/codec.ts';
import { CODE_PART, FIRST_MESSAGE_FIELD, MESSAGE_FIELD_STRIDE } from '../constants.ts';
import { MARKER, TASK_KIND, type FingerprintKind } from '../keys.ts';

export type FoundTask = { code: string; kind: FingerprintKind };

export function findTasks(text: unknown, digits: string, typeName: (type: number) => string | null): FoundTask[] {
  if (typeof text !== 'string' || !text.includes(MARKER)) return [];
  const fields = text.split(FIELD).map(unescField);
  const found: FoundTask[] = [];
  for (let index = FIRST_MESSAGE_FIELD; index < fields.length; index += MESSAGE_FIELD_STRIDE) {
    const parts = splitParts(fields[index] ?? '');
    const type = decodeNumber(parts[0], digits);
    const kind = type !== null ? TASK_KIND[typeName(type) ?? ''] : undefined;
    const code = parts[CODE_PART];
    if (kind && typeof code === 'string' && code.includes(MARKER)) found.push({ code, kind });
  }
  return found;
}
