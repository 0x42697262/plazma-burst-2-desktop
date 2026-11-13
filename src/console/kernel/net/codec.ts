import {
  DECIMAL_RADIX, DELETE_CODE, FIRST_RELIABLE_FIELD, LAST_CONTROL_CODE, ESCAPED_FIELD_SEPARATOR, ESCAPED_PART_SEPARATOR, FIELD_SEPARATOR, JSON_START, NEGATIVE_SIGN,
  PART_CHARS_MAX, PART_SEPARATOR, RELIABLE_FIELD_STRIDE,
} from './constants.ts';
import { TEXT } from './text.ts';

export const FIELD = FIELD_SEPARATOR;
export const PART = PART_SEPARATOR;
export { PART_CHARS_MAX };

export const unescField = (text: string): string => text.split(ESCAPED_FIELD_SEPARATOR).join(FIELD_SEPARATOR);
export const unescPart = (text: string): string => unescField(text).split(ESCAPED_PART_SEPARATOR).join(PART_SEPARATOR);
export const splitParts = (data: string): string[] => data.split(PART_SEPARATOR).map(unescPart);

export const escField = (text: string): string => text.split(FIELD_SEPARATOR).join(ESCAPED_FIELD_SEPARATOR);
export const escPart = (text: string): string => escField(text).split(PART_SEPARATOR).join(ESCAPED_PART_SEPARATOR);
export const joinParts = (parts: readonly string[]): string => parts.map(escPart).join(PART_SEPARATOR);

export type ReliableEntry = { uid: number; data: string; size: number };
export type Packet = { ack: number; state: string; stateSize: number; rel: ReliableEntry[] };

export function parsePacket(text: string): Packet {
  const raw = text.split(FIELD);
  const fields = raw.map(unescField);
  const rel: ReliableEntry[] = [];
  for (let index = FIRST_RELIABLE_FIELD; index + 1 < fields.length; index += RELIABLE_FIELD_STRIDE) {
    rel.push({ uid: parseInt(fields[index] ?? '', DECIMAL_RADIX), data: fields[index + 1] ?? '', size: (raw[index + 1] ?? '').length });
  }
  return { ack: parseInt(fields[0] ?? '', DECIMAL_RADIX), state: fields[1] || '', stateSize: (raw[1] || '').length, rel };
}

export function decodeNumber(text: unknown, digits: string): number | null {
  if (!digits || typeof text !== 'string' || !text) return null;
  const isNegative = text.startsWith(NEGATIVE_SIGN);
  if (isNegative && text.length === NEGATIVE_SIGN.length) return null;
  let value = 0;
  for (const character of isNegative ? text.slice(NEGATIVE_SIGN.length) : text) {
    const digit = digits.indexOf(character);
    if (digit < 0) return null;
    value = value * digits.length + digit;
  }
  return isNegative ? -value : value;
}

const isControlCode = (code: number): boolean => code <= LAST_CONTROL_CODE || code === DELETE_CODE;
const hasControlCharacter = (text: string): boolean => [...text].some((character) => isControlCode(character.charCodeAt(0)));

const isJsonText = (part: string): boolean => {
  if (!JSON_START.test(part)) return false;
  try {
    JSON.parse(part);
    return true;
  } catch {
    return false;
  }
};

export function showPart(part: string, digits: string, isNumber = false, whole = false): string {
  const mayBeEncodedNumber = isNumber || hasControlCharacter(part);
  if (mayBeEncodedNumber) {
    const decoded = decodeNumber(part, digits);
    if (decoded !== null) return String(decoded);
  }
  const isTooLong = !whole && part.length > PART_CHARS_MAX;
  if (isTooLong) return TEXT.cutPart(JSON.stringify(part.slice(0, PART_CHARS_MAX)), part.length);
  return isJsonText(part) ? part : JSON.stringify(part);
}
