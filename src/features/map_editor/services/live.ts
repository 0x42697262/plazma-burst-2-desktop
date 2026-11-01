import { game } from '#console/kernel/game/bindings.ts';
import { kindOf, boundsOf, boxOf, type Box } from '../domain/kinds.ts';
import { TAG } from '../domain/keys.ts';
import type { MapDoc, MapElement } from '../domain/doc.ts';

type Region = { x: number; y: number };

export function liveBounds(_doc: MapDoc | null, item: MapElement): Box | null {
  const onMap = boundsOf(item);
  if (!onMap || !item.live) return onMap;
  if (item.tag === TAG.region) {
    const index = item.live.index as number;
    const region = index < game.regionCount() ? game.regions()?.[index] as Region | undefined : null;
    if (region && Number.isFinite(region.x)) return { x: region.x, y: region.y, w: onMap.w, h: onMap.h };
  }
  if (item.live.char !== undefined) {
    const character = item.live.char < game.charCount() ? game.chars()?.[item.live.char] : null;
    const box = boxOf(kindOf(item.tag) as NonNullable<ReturnType<typeof kindOf>>, item.attrs);
    if (character && character.io && Number.isFinite(character.x)) return { x: character.x + box.x, y: character.y + box.y, w: box.w, h: box.h };
  }
  return onMap;
}
