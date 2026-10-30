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

// The object kinds a value of this kind names, for picking one in the world (the map
// editor's special_values_table[kind]['[listof]']); null when it is not an object.
const PICKS = Object.freeze({
  trigger: ['trigger'], 'trigger+none': ['trigger'], timer: ['timer'],
  door: ['door'], 'door+none': ['door'], region: ['region'], 'region+random': ['region'],
  character: ['player', 'enemy'], vehicle: ['vehicle'], 'vehicle+none+any': ['vehicle'],
  gun: ['gun'], barrel: ['barrel'], decor: ['decor'], lamp: ['lamp'], water: ['water'], pushf: ['pushf'],
  'song+none': ['song'],
});
export const pickKindsOf = (valueKind) => PICKS[valueKind] || null;

// The pictures the map editor shows next to a model or a skin (its server's lists:
// decors/<model>.png, chars_full/char0001.png), and how it shows them.
const PICTURES = Object.freeze({
  decor_model: (v) => ({ src: `/level_editor/decors/${v}.png`, fit: true }),
  char: (v) => (/^\d+$/.test(v) ? { src: `/level_editor/chars_full/char${v.padStart(4, '0')}.png`, head: true } : null),
});

// The rows of the map editor's drop-down for a kind of value, in its order (its
// special_values_table[kind], walked like the editor walks it):
//   { value, label, picture? }               a value it offers (a model or a skin with its picture)
//   { custom: true, label, negative }        "# calls": type a number ("-[val]": it is stored negative)
//   { value, label, icon }                   an object of the map, named as a parameter names it
//   { value, label, category, color }        a trigger action (kind "trigger_type")
// A kind like "team+any" also offers its base kind's values ("team"). [] when the kind
// offers nothing to pick from.
export function dropdownItems(valueKind, doc, referenceTo, nameOf) {
  if (!valueKind) return [];
  if (valueKind === 'trigger_type') return actionItems();
  const values = TABLE?.values || {};
  const base = valueKind.split('+')[0];
  const merged = { ...(base !== valueKind ? values[base] : null), ...values[valueKind] };
  const items = [];
  const picture = PICTURES[valueKind];
  for (const [value, label] of Object.entries(merged)) {
    if (value.includes('[val]')) items.push({ custom: true, label, negative: value.startsWith('-') });
    else items.push({ value, label, ...(picture ? { picture: picture(value) } : {}) });
  }
  const kinds = pickKindsOf(valueKind);
  if (kinds && doc) {
    for (const e of doc.elements) if (kinds.includes(e.tag)) items.push({ value: referenceTo(doc, e), label: nameOf(doc, e), icon: e.tag });
  }
  return items;
}

// Every trigger action, by number, as "Category › what it does" in its category's colour.
function actionItems() {
  if (!TABLE?.actions) return [];
  const colors = new Map((TABLE.categories || []).map((c) => [c.name, c.color]));
  return Object.entries(TABLE.actions)
    .map(([type, a]) => ({ type: Number(type), a }))
    .filter(({ type }) => type >= 0)
    .sort((x, y) => x.type - y.type)
    .map(({ type, a }) => {
      const [category, ...rest] = a.desc.split(' › ');
      const text = rest.length ? rest.join(' › ') : category;
      return { value: String(type), label: a.desc, category: rest.length ? category : '', text, color: colors.get(category) || '#ffffff' };
    });
}

// The categories of trigger actions, in the editor's order, with their colours.
export const actionCategories = () => TABLE?.categories || [];
