import { stringOf } from '#kernel/text/text-of.ts';
import { AGO_DECIMALS, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from './constants.ts';
import {
  ELLIPSIS, ESCAPED_MATCH, HELP_WORDS, HTML_CHARACTER, HTML_ENTITY, HTML_TAG, INDEX_MARK, INDEX_TEXT, NUMBER_TEXT, PATTERN_SPECIAL_CHARACTERS, PLURAL_SUFFIX,
} from './keys.ts';
import { TEXT } from './text.ts';

export const pluralSuffix = (count: number): string => (count === 1 ? '' : PLURAL_SUFFIX);
export const plural = (count: number, noun: string): string => TEXT.counted(count, noun, pluralSuffix(count));
export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export function onOff(value: unknown): string {
  if (value === true) return TEXT.on;
  if (value === false) return TEXT.off;
  return stringOf(value);
}

export const isNumberText = (text: unknown): boolean => NUMBER_TEXT.test(stringOf(text));

export const parseIndex = (text: unknown): number | null => {
  const written = stringOf(text ?? '');
  return INDEX_TEXT.test(written) ? Number(written.replace(INDEX_MARK, '')) : null;
};

export const escapeRe = (text: unknown): string => stringOf(text).replace(PATTERN_SPECIAL_CHARACTERS, ESCAPED_MATCH);

export const quote = (value: unknown, max = Infinity): string => (typeof value === 'string'
  ? JSON.stringify(value.length > max ? value.slice(0, max) + ELLIPSIS : value)
  : stringOf(value));

export const stripHtml = (text: unknown): string => stringOf(text || '').replace(HTML_TAG, '')
  .replace(HTML_ENTITY.lessThan, HTML_CHARACTER.lessThan)
  .replace(HTML_ENTITY.greaterThan, HTML_CHARACTER.greaterThan)
  .replace(HTML_ENTITY.ampersand, HTML_CHARACTER.ampersand)
  .trim();

export function agoText(milliseconds: number): string {
  if (milliseconds < MILLISECONDS_PER_SECOND) return TEXT.now;
  if (milliseconds < MILLISECONDS_PER_MINUTE) return TEXT.secondsAgo((milliseconds / MILLISECONDS_PER_SECOND).toFixed(AGO_DECIMALS));
  return TEXT.minutesAgo(Math.floor(milliseconds / MILLISECONDS_PER_MINUTE), Math.floor((milliseconds % MILLISECONDS_PER_MINUTE) / MILLISECONDS_PER_SECOND));
}

export const isHelpArg = (args: readonly string[]): boolean => args.length === 1 && HELP_WORDS.includes((args[0] ?? '').toLowerCase());
