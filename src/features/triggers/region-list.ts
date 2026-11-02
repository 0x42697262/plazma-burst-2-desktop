import { requireLevel } from '#console/kernel/game/level.ts';
import { regionList } from './model.ts';
import { REGION_LIST_TEXT as TEXT } from './text.ts';

type Region = Record<string, unknown> & { x?: number; y?: number };

export function regionsOrNone(): (Region | null | undefined)[] {
  requireLevel();
  const list = regionList();
  if (!list.length) throw new Error(TEXT.noRegions);
  return list;
}
