import { ITEM_SLOT, MATCHES_SHOWN } from '../constants.ts';
import { GUN_KIND, ITEM_PREFIX, ITEM_SLOT_TEXT, MATCH_SEPARATOR, STANDARD_PREFIX, UNKNOWN_SLOT_TEXT, type GunKind } from '../keys.ts';
import { TEXT } from '../text.ts';

export type Gun = { model: string; name: string; kind: GunKind; slot: number | null };
export type NumberedGun = { gun: Gun; number: number };

export function kindOf(model: string): GunKind {
  if (model.startsWith(ITEM_PREFIX)) return GUN_KIND.items;
  return model.startsWith(STANDARD_PREFIX) ? GUN_KIND.standard : GUN_KIND.custom;
}

export function slotText(slot: number | null): string {
  if (slot === null) return UNKNOWN_SLOT_TEXT;
  return slot === ITEM_SLOT ? ITEM_SLOT_TEXT : String(slot);
}

const matches = (gun: Gun, lowerQuery: string): boolean => gun.model.includes(lowerQuery) || gun.name.toLowerCase().includes(lowerQuery);

export function resolveGun(list: readonly Gun[], query: string, index: number | null): Gun {
  if (index !== null) {
    const numbered = list[index - 1];
    if (!numbered) throw new Error(TEXT.noGunNumber(index));
    return numbered;
  }
  const lowerQuery = query.toLowerCase();
  const exact = list.find((gun) => gun.model === lowerQuery || gun.name.toLowerCase() === lowerQuery);
  if (exact) return exact;
  const hits = list.filter((gun) => matches(gun, lowerQuery));
  const [only] = hits;
  if (hits.length === 1 && only) return only;
  if (!hits.length) throw new Error(TEXT.noGunMatches(query));
  throw new Error(TEXT.ambiguous(query, hits.length, hits.slice(0, MATCHES_SHOWN).map((gun) => gun.model).join(MATCH_SEPARATOR), hits.length > MATCHES_SHOWN));
}

export function filterGuns(list: readonly Gun[], filter: string | undefined): NumberedGun[] {
  const lowerFilter = (filter ?? '').toLowerCase();
  return list.map((gun, index) => ({ gun, number: index + 1 })).filter(({ gun }) => !lowerFilter || matches(gun, lowerFilter));
}
