import { MAP_MARKER } from '#shared/contract/keys.ts';
import { unplacedSpots } from '#features/triggers/logic/graph.ts';
import { ATTRIBUTE_PATTERN, CHARACTER_TAGS, ELEMENT_PATTERN, NEW_ELEMENT_PREFIX, serializeElement } from './keys.ts';

export type Attrs = Record<string, string>;
export type AttrValues = Record<string, string | undefined>;
export type Spot = { x: number; y: number };
export type LiveInfo = { index?: number; char?: number | undefined; loaded?: Attrs };
export type MapElement = {
  id: number;
  tag: string;
  attrs: Attrs;
  raw: string | null;
  before: string;
  live: LiveInfo | null;
  spot?: Spot;
};

let nextId = 1;

function element(tag: string, attrs: Attrs, raw: string | null, before: string): MapElement {
  return { id: nextId++, tag, attrs, raw, before, live: null };
}

export const newElement = (tag: string, attrs: Attrs): MapElement => element(tag, { ...attrs }, null, NEW_ELEMENT_PREFIX);

export function parseMap(text: string): { elements: MapElement[]; tail: string } {
  const elements: MapElement[] = [];
  let at = 0;
  for (const match of text.matchAll(ELEMENT_PATTERN)) {
    const attrs: Attrs = {};
    for (const attribute of (match[2] ?? '').matchAll(ATTRIBUTE_PATTERN)) attrs[attribute[1] ?? ''] = attribute[2] ?? '';
    elements.push(element(match[1] ?? '', attrs, match[0], text.slice(at, match.index)));
    at = match.index + match[0].length;
  }
  return { elements, tail: text.slice(at) };
}

export class MapDoc {
  source: string;
  elements: MapElement[];
  tail: string;
  version: number;
  ordinals: Map<number, number> | null;

  constructor(text: string) {
    const { elements, tail } = parseMap(text);
    this.source = text;
    this.elements = elements;
    this.tail = tail;
    this.version = 0;
    this.ordinals = null;
    this.markLoaded();
    this.placeUnplaced();
  }

  placeUnplaced(): void {
    for (const [item, spot] of unplacedSpots(this.elements)) item.spot = spot;
  }

  markLoaded(): void {
    const count: Record<string, number> = {};
    let chars = 0;
    for (const item of this.elements) {
      const index = (count[item.tag] ?? -1) + 1;
      count[item.tag] = index;
      item.live = { index, char: CHARACTER_TAGS.has(item.tag) ? chars++ : undefined, loaded: { ...item.attrs } };
    }
  }

  static of(text: unknown): MapDoc | null {
    return typeof text === 'string' && text && !text.startsWith(MAP_MARKER.compressedPrefix) ? new MapDoc(text) : null;
  }

  toText(): string {
    return this.elements.map((item) => item.before + (item.raw ?? serializeElement(item.tag, item.attrs))).join('') + this.tail;
  }

  byTag(tag: string): MapElement[] {
    return this.elements.filter((item) => item.tag === tag);
  }

  byId(id: number): MapElement | null {
    return this.elements.find((item) => item.id === id) || null;
  }

  byUid(uid: string): MapElement | null {
    return this.elements.find((item) => item.attrs.uid === uid) || null;
  }

  ordinal(target: MapElement): number | undefined {
    if (!this.ordinals) {
      const ordinals = new Map<number, number>();
      const count: Record<string, number> = {};
      for (const item of this.elements) {
        const index = (count[item.tag] ?? -1) + 1;
        count[item.tag] = index;
        ordinals.set(item.id, index);
      }
      this.ordinals = ordinals;
    }
    return this.ordinals.get(target.id);
  }

  set(target: MapElement, attr: string, value: string | undefined): boolean {
    if (value === undefined) {
      if (!(attr in target.attrs)) return false;
      delete target.attrs[attr];
    } else {
      if (target.attrs[attr] === value) return false;
      target.attrs[attr] = value;
    }
    target.raw = null;
    this.version++;
    return true;
  }

  insert(target: MapElement, at: number = this.elements.length): number {
    this.elements.splice(at, 0, target);
    this.ordinals = null;
    this.version++;
    return at;
  }

  remove(target: MapElement): number {
    const at = this.elements.indexOf(target);
    if (at < 0) return -1;
    this.elements.splice(at, 1);
    this.ordinals = null;
    this.version++;
    return at;
  }
}
