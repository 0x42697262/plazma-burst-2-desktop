import { SAVE_KEY } from '#kernel/game-save/keys.ts';
import {
  FALSE_TEXT, HIDDEN_VALUE, NOT_A_NUMBER, TRUE_TEXT, UNDEFINED_TEXT, UPLOAD_SKIPPED_CHARACTERS, UPLOAD_SKIPPED_START, UPLOAD_SKIPPED_VALUE_PARTS,
} from '../keys.ts';

export type FieldValue = string | number | boolean;

export const isStorableText = (text: string): boolean => text !== '' && text !== NOT_A_NUMBER && text !== UNDEFINED_TEXT;

export function parseFieldValue(text: string): FieldValue {
  if (text === TRUE_TEXT) return true;
  if (text === FALSE_TEXT) return false;
  return String(Number(text)) === NOT_A_NUMBER ? text : Number(text);
}

export function fieldShown(name: string, value: unknown): string {
  if (name === SAVE_KEY.proof) return HIDDEN_VALUE;
  return typeof value === 'string' ? JSON.stringify(value) : String(value);
}

export const uploadSkipsName = (name: string): boolean => !name || name.startsWith(UPLOAD_SKIPPED_START) || UPLOAD_SKIPPED_CHARACTERS.test(name);

export const uploadSkipsValue = (value: FieldValue): boolean => {
  const text = String(value);
  return !isStorableText(text) || UPLOAD_SKIPPED_VALUE_PARTS.some((part) => text.includes(part));
};
