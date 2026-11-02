import { takeOptions } from '#console/kernel/core/args.ts';
import { SHOW_LAST_DEFAULT, SHOW_LAST_MAX } from '../constants.ts';
import {
  CONNECTION_WORD_SEPARATOR, DIRECTION, FILTER_OPTION, FILTER_TERM, FILTER_TERM_PATTERN, KIND_OPTIONS, MESSAGE_TYPE_IN_LINE, TYPE_PREFIX_AT_START,
} from '../keys.ts';
import { FILTER_TEXT } from '../text.ts';
import { parseLine } from './line.ts';

export type LineFilter = { run: string | null; last: number; test: (line: string) => boolean; filtered: boolean };

const OPTIONS = [FILTER_OPTION.in, FILTER_OPTION.out, ...Object.keys(KIND_OPTIONS)];
const TERMS: readonly string[] = Object.values(FILTER_TERM);

function parseLast(value: string): number {
  const last = Number(value);
  const isInRange = Number.isInteger(last) && last >= 1 && last <= SHOW_LAST_MAX;
  if (!isInRange) throw new Error(FILTER_TEXT.lastRange);
  return last;
}

export function parseFilter(args: readonly string[]): LineFilter {
  const { options, rest } = takeOptions(args, OPTIONS) as { options: Set<string>; rest: string[] };
  if (options.has(FILTER_OPTION.in) && options.has(FILTER_OPTION.out)) throw new Error(FILTER_TEXT.inAndOut);
  const kinds = new Set([...options].map((option) => KIND_OPTIONS[option]).filter((kind): kind is string => kind !== undefined));
  const terms: { run: string | null; type: string | null; conn: string | null } = { run: null, type: null, conn: null };
  let last = SHOW_LAST_DEFAULT;
  const words: string[] = [];
  for (const word of rest) {
    const match = FILTER_TERM_PATTERN.exec(word);
    const key = match?.[1]?.toLowerCase();
    if (!match || !key || !TERMS.includes(key)) {
      words.push(word.toLowerCase());
      continue;
    }
    const value = match[2] ?? '';
    if (!value) throw new Error(FILTER_TEXT.needsValue(key, FILTER_TEXT.termExamples[key] ?? ''));
    if (key === FILTER_TERM.last) last = parseLast(value);
    else terms[key as keyof typeof terms] = value;
  }
  const direction = options.has(FILTER_OPTION.in) ? DIRECTION.in : options.has(FILTER_OPTION.out) ? DIRECTION.out : null;
  const type = terms.type && terms.type.toUpperCase().replace(TYPE_PREFIX_AT_START, '');
  const connection = terms.conn && terms.conn.toLowerCase();
  const hasAllWords = (line: string): boolean => {
    const lower = line.toLowerCase();
    return words.every((word) => lower.includes(word));
  };
  const test = (line: string): boolean => {
    const parsed = parseLine(line);
    if (!parsed) return !direction && !kinds.size && !type && !connection && hasAllWords(line);
    if (direction && parsed.dir !== direction) return false;
    if (kinds.size && !kinds.has(parsed.kind)) return false;
    const hasType = !type || [...parsed.text.matchAll(MESSAGE_TYPE_IN_LINE)].some((found) => (found[1] ?? '').includes(type));
    if (!hasType) return false;
    const hasConnection = !connection || parsed.conn.toLowerCase().split(CONNECTION_WORD_SEPARATOR).some((part) => part === connection || part.startsWith(connection));
    if (!hasConnection) return false;
    return hasAllWords(line);
  };
  return { run: terms.run, last, test, filtered: !!(direction || kinds.size || type || connection || words.length) };
}
