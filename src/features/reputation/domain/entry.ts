import { HASH, TAG } from '../constants.ts';

export type Entry = Readonly<{ tag: string | null; relations: number; oldest: number | null; starts: readonly number[] }>;

const startOf = (row: unknown): number | null => {
  if (!row || typeof row !== 'object') return null;
  const since = (row as Record<string, unknown>).since;
  return typeof since === 'number' && Number.isFinite(since) ? since : null;
};

function hashOf(numbers: readonly number[]): string {
  let hash = HASH.offset;
  for (const character of numbers.join(TAG.separator)) hash = Math.imul(hash ^ character.charCodeAt(0), HASH.prime) >>> 0;
  return hash.toString(TAG.radix).padStart(TAG.length, TAG.pad);
}

export function entryOf(rows: readonly unknown[]): Entry {
  const starts = [...new Set(rows.map(startOf).filter((start): start is number => start !== null))].sort((first, second) => first - second);
  if (!starts.length) return { tag: null, relations: 0, oldest: null, starts };
  return { tag: hashOf(starts), relations: starts.length, oldest: starts[0] ?? null, starts };
}

export const sharedWith = (first: Entry, second: Entry): number => {
  const theirs = new Set(second.starts);
  return first.starts.filter((start) => theirs.has(start)).length;
};
