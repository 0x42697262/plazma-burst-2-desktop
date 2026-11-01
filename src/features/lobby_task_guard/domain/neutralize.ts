import { FIELD, decodeNumber, escField, joinParts, splitParts, unescField } from '#console/kernel/net/codec.ts';
import { CODE_PART, FIRST_MESSAGE_FIELD, MESSAGE_FIELD_STRIDE } from '../constants.ts';
import { NEUTRAL_TASK_CODE, TASK_TYPE_NAMES } from '../keys.ts';

export type TypeNameOf = (type: number) => string | null;
export type Neutralized = { text: string; replaced: number };

export function neutralizeTasks(text: string, digits: string, typeName: TypeNameOf): Neutralized {
  const fields = text.split(FIELD);
  let replaced = 0;
  for (let index = FIRST_MESSAGE_FIELD; index < fields.length; index += MESSAGE_FIELD_STRIDE) {
    const parts = splitParts(unescField(fields[index] ?? ''));
    const type = decodeNumber(parts[0], digits);
    const isTask = type !== null && TASK_TYPE_NAMES.includes(typeName(type) ?? '');
    if (!isTask || parts.length <= CODE_PART) continue;
    parts[CODE_PART] = NEUTRAL_TASK_CODE;
    fields[index] = escField(joinParts(parts));
    replaced++;
  }
  return { text: replaced ? fields.join(FIELD) : text, replaced };
}
