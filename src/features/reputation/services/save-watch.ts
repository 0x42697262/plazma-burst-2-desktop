import { SEEN_KEPT } from '../constants.ts';
import type { SaveSeen } from '../domain/device.ts';

export type SeenSaves = Readonly<{ loads: SaveSeen[]; uploads: SaveSeen[] }>;
export type SaveWatch = Readonly<{ load(seen: SaveSeen): void; upload(seen: SaveSeen): void; snapshot(): SeenSaves }>;

export function createSaveWatch(): SaveWatch {
  const loads: SaveSeen[] = [];
  const uploads: SaveSeen[] = [];
  const keep = (list: SaveSeen[], seen: SaveSeen): void => {
    list.push(seen);
    if (list.length > SEEN_KEPT) list.splice(0, list.length - SEEN_KEPT);
  };
  return Object.freeze({
    load: (seen: SaveSeen) => { keep(loads, seen); },
    upload: (seen: SaveSeen) => { keep(uploads, seen); },
    snapshot: () => ({ loads: [...loads], uploads: [...uploads] }),
  });
}
