// What the params panel shows for a kind, as the map editor does: every parameter that
// kind has (its place, its size for a rectangle, and the editor's defaults for it),
// whether the map writes it or not, with the editor's title and description, and the
// values a parameter offers (teams, activation modes, materials, ...). The titles and
// values come from desktop/dev/opcodes.js ("npm run fetch-opcodes"); without them the
// attribute names are shown.
import { kindOf, SHAPE, DEFAULTS, NO_UID } from './kinds.js';

const TABLE = globalThis.PB2_OPCODES || null;
const ANY_KIND = '*';

// The attributes a kind has, in the editor's order of making them.
export function paramsOf(tag) {
  const kind = kindOf(tag);
  if (!kind) return [];
  return [
    ...(NO_UID.has(tag) ? [] : ['uid']),
    'x', 'y', ...(kind.shape === SHAPE.RECT ? ['w', 'h'] : []),
    ...Object.keys(DEFAULTS[tag] || {}),
  ];
}

// The value a parameter has when the map leaves it out: the editor's default.
export const defaultOf = (tag, attr) => DEFAULTS[tag]?.[attr];

// { title, desc, kind } of an attribute: the editor's row for this kind, else its row
// for any kind; null when the editor has none.
export function paramInfo(tag, attr) {
  const rows = TABLE?.params || [];
  const row = rows.find((p) => p.name === attr && p.cls === tag) || rows.find((p) => p.name === attr && p.cls === ANY_KIND);
  return row ? { title: row.title, desc: row.desc, kind: row.kind } : null;
}

// [{ value, label }] a kind of value offers ("team", "region_activation", ...), or [].
export function choicesOf(valueKind) {
  const values = valueKind && TABLE?.values?.[valueKind];
  return values ? Object.entries(values).map(([value, label]) => ({ value, label })) : [];
}

// How a value reads: "9 (''USE'' key, only Red team)" when it has a label.
export function shownValue(valueKind, value) {
  const label = valueKind && TABLE?.values?.[valueKind]?.[value];
  return label ? `${value} (${label})` : value;
}
