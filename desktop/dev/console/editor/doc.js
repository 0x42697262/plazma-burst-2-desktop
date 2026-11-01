// The map being edited, as the map text lists it: one element per tag, in map order,
// each with its attributes. The game numbers each kind in that order (the third <region>
// is region #2). An element's ordinal is its place in the document now; `live` is where
// the running game has it, from when the level loaded this text: elements added since
// have none, and deleting one does not move the others in the game.
// Untouched elements keep their exact text; toText() gives the map back.
import { MAP_MARKER as MAP } from '../../../../src/shared/contract/keys.ts';
import { unplacedSpots } from '../logic/graph.js';

// <tag a="..." b="..." />. Values hold no quotes (the editor escapes them), so ">"
// inside one is fine.
const TAG = /<([a-z_0-9]+)((?:\s+[A-Za-z0-9_]+="[^"]*")*)\s*\/?>/g;
const ATTR = /([A-Za-z0-9_]+)="([^"]*)"/g;

let nextId = 1;

const LINE = '\n'; // what goes in front of an added element

function element(tag, attrs, raw, before) {
  return { id: nextId++, tag, attrs, raw, before, live: null };
}

// A new element, not in any document yet.
export const newElement = (tag, attrs) => element(tag, { ...attrs }, null, LINE);

// Players and enemies share the game's characters array, in map order.
const CHAR_TAGS = new Set(['player', 'enemy']);

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
    this.markLoaded();
    this.placeUnplaced();
  }

  // Old maps leave out x and y of triggers, timers and engine marks: they get e.spot,
  // where the editor (and "logic show") shows them, written to the map only once moved.
  placeUnplaced() {
    for (const [e, spot] of unplacedSpots(this.elements)) e.spot = spot;
  }

  // The game has just loaded this text: every element is where the document has it.
  // live.index: its index among its kind; live.char: its character, for players;
  // live.loaded: its attributes as the game read them.
  markLoaded() {
    const count = {};
    let chars = 0;
    for (const e of this.elements) {
      count[e.tag] = (count[e.tag] ?? -1) + 1;
      e.live = { index: count[e.tag], char: CHAR_TAGS.has(e.tag) ? chars++ : undefined, loaded: { ...e.attrs } };
    }
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

  // Changes one attribute (undefined removes it); the element is written out again from
  // its attributes.
  set(e, attr, value) {
    if (value === undefined) {
      if (!(attr in e.attrs)) return false;
      delete e.attrs[attr];
    } else {
      if (e.attrs[attr] === String(value)) return false;
      e.attrs[attr] = String(value);
    }
    e.raw = null;
    this.version++;
    return true;
  }

  // Adds an element at position `at` (default: the end, so no other element of its
  // kind changes its number). Returns where it went.
  insert(e, at = this.elements.length) {
    this.elements.splice(at, 0, e);
    this.ordinals = null;
    this.version++;
    return at;
  }

  // Takes an element out; returns where it was, for putting it back.
  remove(e) {
    const at = this.elements.indexOf(e);
    if (at < 0) return -1;
    this.elements.splice(at, 1);
    this.ordinals = null;
    this.version++;
    return at;
  }
}
