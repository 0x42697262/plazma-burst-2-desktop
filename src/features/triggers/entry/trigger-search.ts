import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { UNLIMITED } from '../keys.ts';
import type { Action, Trigger, TriggerSource } from '../types.ts';
import {
  BY_TERM, BY_WORDS, COMPARE, COMPARISON, DIGITS, EQUALS, FIELD, HASH, NO_SOURCE, NUMBERED_SOURCES, NUMBER_TEXT, TERM, UNLIMITED_WORDS,
} from './keys.ts';
import { TRIGGERS_TEXT as TEXT } from './text.ts';

export type Term = {
  field: string;
  text: string;
  num: number | null;
  uid?: string;
  kind?: string;
  index?: number | null;
  compare?: (first: number, second: number) => boolean;
  value?: number;
};

export const BY_WORD_LIST = Object.keys(BY_WORDS).join(TEXT.flagSeparator);

const asCount = (count: unknown): number => (count === UNLIMITED ? Infinity : count as number);
export const countOf = (trigger: Trigger, field: string): number => asCount(trigger[field === FIELD.calls ? GAME_FIELDS.T_CALLS : GAME_FIELDS.T_MAX_CALLS]);

function parseCount(field: string, text: string): Pick<Term, 'compare' | 'value'> {
  const match = COMPARISON.exec(text);
  const operator = match?.[1] || EQUALS;
  const word = match?.[2] ?? '';
  const value = UNLIMITED_WORDS.includes(word) ? Infinity : DIGITS.test(word) ? Number(word) : null;
  if (value === null) throw new Error(TEXT.countExpected(field));
  return { compare: COMPARE[operator], value };
}

function parseBy(text: string): Pick<Term, 'uid' | 'kind' | 'index'> {
  if (text.startsWith(HASH)) return { uid: text };
  const match = BY_TERM.exec(text);
  const kind = match ? BY_WORDS[match[1] ?? ''] : undefined;
  if (!match || !kind) throw new Error(TEXT.byExpected(BY_WORD_LIST));
  const index = match[2] === undefined ? null : Number(match[2]);
  if (index !== null && !NUMBERED_SOURCES.has(kind)) throw new Error(TEXT.byNoNumber(match[1] ?? ''));
  return { kind, index };
}

export function parseTerms(args: readonly string[], usage: string): Term[] {
  return args.map((raw) => {
    const match = TERM.exec(raw);
    const field = match ? (match[1] ?? '').toLowerCase() : FIELD.any;
    const text = (match ? match[2] ?? '' : raw).toLowerCase();
    if (!text) throw new Error(usage);
    if (field === FIELD.type && !DIGITS.test(text)) throw new Error(TEXT.typeExpected);
    const extra = field === FIELD.by ? parseBy(text) : field === FIELD.calls || field === FIELD.maxcalls ? parseCount(field, text) : {};
    return { field, text, num: NUMBER_TEXT.test(text) ? Number(text) : null, ...extra };
  });
}

function valueMatches(value: unknown, term: Term): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'number') return term.num !== null && value === term.num;
  const written = stringOf(value).toLowerCase();
  return term.num !== null && NUMBER_TEXT.test(written) ? Number(written) === term.num : written.includes(term.text);
}

export const uidMatches = (trigger: Trigger, term: Term): boolean => stringOf(trigger.uid || '').toLowerCase().includes(term.text);

export function bySources(sources: readonly TriggerSource[], term: Term): TriggerSource[] | null {
  if (term.kind === NO_SOURCE) return sources.length ? null : [];
  const hits = term.uid
    ? sources.filter((source) => source.uid?.toLowerCase() === term.uid)
    : sources.filter((source) => source.kind === term.kind && (term.index === null || term.index === undefined || source.index === term.index));
  return hits.length ? hits : null;
}

export function actionMatches({ type, A, B }: Action, term: Term): boolean {
  switch (term.field) {
    case FIELD.type: return type === term.num;
    case FIELD.a: return valueMatches(A, term);
    case FIELD.b: return valueMatches(B, term);
    default: return valueMatches(A, term) || valueMatches(B, term);
  }
}
