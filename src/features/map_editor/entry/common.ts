import { stringOf } from '#kernel/text/text-of.ts';
import { KINDS, KIND_TAGS, type Kind } from '../domain/kinds.ts';
import { LAYER_GROUPS, editorShown } from '../services/session.ts';
import { LAYER_ALL, LAYER_WORD_SEPARATOR } from '../keys.ts';
import { COMMAND_TEXT as TEXT } from '../text.ts';

export function requireShown(): void {
  if (!editorShown()) throw new Error(TEXT.notShown);
}

export const kindTitle = (tag: string): string => (KINDS[tag] as Kind).title;

export function kindWord(word: string | undefined): string | null {
  const lowered = stringOf(word || '').toLowerCase();
  return KIND_TAGS.find((tag) => tag === lowered || kindTitle(tag) === lowered) || null;
}

export const kindWords = KIND_TAGS.map(kindTitle).join(TEXT.listSeparator);

export function kindsOf(word: string): string[] | null {
  const lowered = word.toLowerCase();
  if (lowered === LAYER_ALL) return [...KIND_TAGS];
  if (Object.hasOwn(LAYER_GROUPS, lowered)) return [...LAYER_GROUPS[lowered] ?? []];
  const tags = lowered.split(LAYER_WORD_SEPARATOR).filter(Boolean).map(kindWord);
  return tags.length && !tags.includes(null) ? tags as string[] : null;
}
