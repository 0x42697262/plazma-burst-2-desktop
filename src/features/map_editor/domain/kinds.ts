import { BOX, DECIMAL_RADIX, TIDY_PRECISION, VEHICLE_BOX, type Box } from './constants.ts';
import { CHARACTER_TAGS, DEFAULTS, KIND_LOOK, NO_UID, NOT_PLACED, SHAPE, TAG, uidPrefix, type Shape } from './keys.ts';
import { DOMAIN_TEXT as TEXT } from './text.ts';
import type { Attrs, MapDoc, MapElement, Spot } from './doc.ts';

export { SHAPE, DEFAULTS, NO_UID, NOT_PLACED, type Box };

export type BoxOf = Box | ((attrs: Attrs) => Box);
export type Kind = { title: string; color: string; shape: Shape; box?: BoxOf };
export type Placed = { tag: string; attrs: Attrs; spot?: Spot };

const rect = (tag: keyof typeof KIND_LOOK): Kind => ({ ...KIND_LOOK[tag], shape: SHAPE.RECT });
const point = (tag: keyof typeof KIND_LOOK, box: BoxOf): Kind => ({ ...KIND_LOOK[tag], shape: SHAPE.POINT, box });

export const KINDS: Readonly<Record<string, Kind>> = Object.freeze({
  box: rect('box'),
  door: rect('door'),
  region: rect('region'),
  bg: rect('bg'),
  water: rect('water'),
  pushf: rect('pushf'),
  player: point('player', BOX.actor),
  enemy: point('enemy', BOX.actor),
  vehicle: point('vehicle', (attrs: Attrs) => (attrs.model !== undefined && Object.hasOwn(VEHICLE_BOX, attrs.model) ? VEHICLE_BOX[attrs.model] : undefined) || BOX.vehicle),
  barrel: point('barrel', BOX.barrel),
  gun: point('gun', BOX.gun),
  decor: point('decor', BOX.marker),
  lamp: point('lamp', BOX.marker),
  trigger: point('trigger', BOX.marker),
  timer: point('timer', BOX.marker),
  song: point('song', BOX.marker),
  inf: point('inf', BOX.marker),
  image: point('image', BOX.marker),
});

export const KIND_TAGS: readonly string[] = Object.freeze(Object.keys(KINDS));
export const kindOf = (tag: string): Kind | null => (Object.hasOwn(KINDS, tag) ? KINDS[tag] ?? null : null);

export const tidy = (value: number): string => String(Math.round(value * TIDY_PRECISION) / TIDY_PRECISION);

const numberOf = (value: string | undefined): number => (value === undefined || value === '' ? NaN : Number(value));

export const boxOf = (kind: Kind, attrs: Attrs): Box => (typeof kind.box === 'function' ? kind.box(attrs) : kind.box as Box);

export const anchorOf = (item: Placed): Spot => (item.attrs.x === undefined && item.spot ? { ...item.spot } : { x: numberOf(item.attrs.x), y: numberOf(item.attrs.y) });

export function boundsOf(item: Placed): Box | null {
  const kind = kindOf(item.tag);
  if (!kind) return null;
  const { x: anchorX, y: anchorY } = anchorOf(item);
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY)) return null;
  if (kind.shape === SHAPE.RECT) {
    const width = numberOf(item.attrs.w);
    const height = numberOf(item.attrs.h);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return { x: Math.min(anchorX, anchorX + width), y: Math.min(anchorY, anchorY + height), w: Math.abs(width), h: Math.abs(height) };
  }
  const box = boxOf(kind, item.attrs);
  const left = numberOf(item.attrs.side) === -1 ? -box.x - box.w : box.x;
  return { x: anchorX + left, y: anchorY + box.y, w: box.w, h: box.h };
}

export const nameOf = (doc: MapDoc, item: MapElement): string => item.attrs.uid || TEXT.numberedName(kindOf(item.tag)?.title || item.tag, doc.ordinal(item));

export function newUid(doc: MapDoc, tag: string): string | undefined {
  if (NO_UID.has(tag)) return undefined;
  const prefix = uidPrefix(tag);
  let highest = 0;
  for (const item of doc.elements) {
    const uid = item.attrs.uid;
    if (uid && uid.startsWith(prefix)) highest = Math.max(highest, parseInt(uid.slice(prefix.length), DECIMAL_RADIX) || 0);
  }
  return prefix + String(highest + 1);
}

export function referenceTo(doc: MapDoc, item: MapElement): string {
  if (item.attrs.uid) return item.attrs.uid;
  if (CHARACTER_TAGS.has(item.tag)) {
    return String(doc.elements.filter((other) => other.tag === TAG.player || other.tag === TAG.enemy).indexOf(item));
  }
  return String(doc.ordinal(item));
}
