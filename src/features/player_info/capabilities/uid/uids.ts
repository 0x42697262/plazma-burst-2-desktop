import { CHARACTER_TAG, UID_ATTRIBUTE } from './keys.ts';

export function characterUids(mapText: string): (string | null)[] {
  return [...mapText.matchAll(CHARACTER_TAG)].map((match) => UID_ATTRIBUTE.exec(match[1] ?? '')?.[1] || null);
}
