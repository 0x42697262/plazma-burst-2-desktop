import {
  DELETE_CODE, LAST_CONTROL_CODE, ESCAPED_FIELD_SEPARATOR, ESCAPED_PART_SEPARATOR, FIELD_SEPARATOR, JSON_START, NEGATIVE_SIGN,
  PART_CHARS_MAX, PART_SEPARATOR,
} from './constants.ts';
import { TEXT } from './text.ts';

export const FIELD = FIELD_SEPARATOR;
export const PART = PART_SEPARATOR;
export { PART_CHARS_MAX };

export const unescField = (text: string): string => text.split(ESCAPED_FIELD_SEPARATOR).join(FIELD_SEPARATOR);
export const unescPart = (text: string): string => unescField(text).split(ESCAPED_PART_SEPARATOR).join(PART_SEPARATOR);
export const splitParts = (data: string): string[] => data.split(PART_SEPARATOR).map(unescPart);

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
