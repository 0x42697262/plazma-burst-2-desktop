import { ENTRIES_KEPT } from '../constants.ts';
import { EMPTY_LIST, ENTRY_STORAGE_KEY } from '../keys.ts';

export type SeenEntry = Readonly<{ at: number; tag: string | null; starts: readonly number[]; reputation: string }>;

const storage = (): Storage | null => {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
};

export function seenEntries(): SeenEntry[] {
  try {
    const kept: unknown = JSON.parse(storage()?.getItem(ENTRY_STORAGE_KEY) ?? EMPTY_LIST);
    return Array.isArray(kept) ? kept as SeenEntry[] : [];
  } catch {
    return [];
  }
}

export function keepEntry(entry: SeenEntry): void {
  try {
    storage()?.setItem(ENTRY_STORAGE_KEY, JSON.stringify([...seenEntries(), entry].slice(-ENTRIES_KEPT)));
  } catch {
    return;
  }
}
