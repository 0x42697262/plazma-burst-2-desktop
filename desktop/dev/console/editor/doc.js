// The map being edited, as the map text lists it: one element per tag, in map order,
// each with its attributes. The game numbers each kind in that order (the third <region>
// is region #2), so an element's ordinal among its tag is its index in the running game.
// Untouched elements keep their exact text; toText() gives the map back.
import { MAP } from '../core/shared.js';

// <tag a="..." b="..." />. Values hold no quotes (the editor escapes them), so ">"
// inside one is fine.
const TAG = /<([a-z_0-9]+)((?:\s+[A-Za-z0-9_]+="[^"]*")*)\s*\/?>/g;
const ATTR = /([A-Za-z0-9_]+)="([^"]*)"/g;

let nextId = 1;

function element(tag, attrs, raw, before) {
  return { id: nextId++, tag, attrs, raw, before };
}

export function parseMap(text) {
  const elements = [];
  let at = 0;
  for (const m of text.matchAll(TAG)) {
    const attrs = {};
    for (const a of m[2].matchAll(ATTR)) attrs[a[1]] = a[2];
    elements.push(element(m[1], attrs, m[0], text.slice(at, m.index)));
    at = m.index + m[0].length;
  }
  return { elements, tail: text.slice(at) };
}

const serialize = (e) => `<${e.tag}${Object.entries(e.attrs).map(([k, v]) => ` ${k}="${v}"`).join('')} />`;

export class MapDoc {
  constructor(text) {
    const { elements, tail } = parseMap(text);
    this.source = text;
    this.elements = elements;
    this.tail = tail;
    this.version = 0; // goes up with every change, so views redraw what changed
    this.ordinals = null;
  }

  // null for map text the editor cannot read (compressed until the level starts).
  static of(text) {
    return typeof text === 'string' && text && !text.startsWith(MAP.compressedPrefix) ? new MapDoc(text) : null;
  }

  toText() {
    return this.elements.map((e) => e.before + (e.raw ?? serialize(e))).join('') + this.tail;
  }

  byTag(tag) {
    return this.elements.filter((e) => e.tag === tag);
  }

  byId(id) {
    return this.elements.find((e) => e.id === id) || null;
  }

  byUid(uid) {
    return this.elements.find((e) => e.attrs.uid === uid) || null;
  }

  // The element's index in the game: its place among the elements of its tag.
  ordinal(e) {
    if (!this.ordinals) {
      this.ordinals = new Map();
      const count = {};
      for (const el of this.elements) {
        count[el.tag] = (count[el.tag] ?? -1) + 1;
        this.ordinals.set(el.id, count[el.tag]);
      }
    }
    return this.ordinals.get(e.id);
  }

  // Changes one attribute; the element is written out again from its attributes.
  set(e, attr, value) {
    if (e.attrs[attr] === String(value)) return false;
    e.attrs[attr] = String(value);
    e.raw = null;
    this.version++;
    return true;
  }
}
