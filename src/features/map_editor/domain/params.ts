import { OPCODES_GLOBAL } from '#features/triggers/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { DEFAULTS, NO_UID, SHAPE, kindOf } from './kinds.ts';
import {
  ACTION_CATEGORY_SEPARATOR, ANY_KIND, CUSTOM_VALUE_MARK, DEFAULT_ACTION_COLOR, GAME_ONLY, KIND_SEPARATOR, NEGATIVE_MARK, NO_PLACE, PAIRED, PICKS, PICTURES,
  PLACE_ATTRS, SIZE_ATTRS, TRIGGER_TYPE_KIND, UID_ATTR, UNPAIRED, type Picture,
} from './keys.ts';
import { DOMAIN_TEXT as TEXT } from './text.ts';
import type { Attrs, MapDoc, MapElement } from './doc.ts';

type ParamRow = { name: string; cls: string; title: string; desc: string; kind: string };
type ActionCategory = { name: string; color: string };
type OpcodeTable = {
  params?: ParamRow[];
  markPairs?: Record<string, string>;
  values?: Record<string, Record<string, string>>;
  actions?: Record<string, { desc: string }>;
  categories?: ActionCategory[];
};

export type ParamInfo = { title: string; desc: string; kind: string };
export type DropdownItem = {
  value?: string;
  label?: string;
  picture?: Picture | null;
  custom?: boolean;
  negative?: boolean;
  icon?: string;
  category?: string;
  text?: string;
  color?: string;
};
type Namer = (doc: MapDoc, item: MapElement) => string;

const TABLE = (Reflect.get(globalThis, OPCODES_GLOBAL) as OpcodeTable | undefined) || null;

export function paramsOf(tag: string): string[] {
  const kind = kindOf(tag);
  if (!kind) return [];
  return [
    ...(NO_UID.has(tag) ? [] : [UID_ATTR]),
    ...(NO_PLACE.has(tag) ? [] : PLACE_ATTRS), ...(kind.shape === SHAPE.RECT ? SIZE_ATTRS : []),
    ...Object.keys(DEFAULTS[tag] || {}),
    ...Object.keys(GAME_ONLY[tag] || {}),
  ];
}

export const defaultOf = (tag: string, attr: string): string | undefined => DEFAULTS[tag]?.[attr] ?? GAME_ONLY[tag]?.[attr]?.value;

export function paramInfo(tag: string, attr: string, attrs: Attrs = {}): ParamInfo | null {
  const rows = TABLE?.params || [];
  const row = rows.find((param) => param.name === attr && param.cls === tag) || GAME_ONLY[tag]?.[attr]
    || rows.find((param) => param.name === attr && param.cls === ANY_KIND);
  if (!row) return null;
  const pairedWith = PAIRED[tag]?.[attr];
  const kind = pairedWith ? TABLE?.markPairs?.[stringOf(attrs[pairedWith] ?? defaultOf(tag, pairedWith))] ?? UNPAIRED : row.kind;
  return { title: row.title, desc: row.desc, kind };
}

export function choicesOf(valueKind: string | undefined): { value: string; label: string }[] {
  const values = valueKind && TABLE?.values?.[valueKind];
  return values ? Object.entries(values).map(([value, label]) => ({ value, label })) : [];
}

export function shownValue(valueKind: string | undefined, value: string): string {
  const label = valueKind && TABLE?.values?.[valueKind]?.[value];
  return label ? TEXT.labelledValue(value, label) : value;
}

export const pickKindsOf = (valueKind: string | undefined): readonly string[] | null => (valueKind && Object.hasOwn(PICKS, valueKind) ? PICKS[valueKind] ?? null : null);

function actionItems(): DropdownItem[] {
  if (!TABLE?.actions) return [];
  const colors = new Map((TABLE.categories || []).map((category) => [category.name, category.color]));
  return Object.entries(TABLE.actions)
    .map(([type, action]) => ({ type: Number(type), action }))
    .filter(({ type }) => type >= 0)
    .sort((first, second) => first.type - second.type)
    .map(({ type, action }) => {
      const [category = '', ...rest] = action.desc.split(ACTION_CATEGORY_SEPARATOR);
      const text = rest.length ? rest.join(ACTION_CATEGORY_SEPARATOR) : category;
      return { value: String(type), label: action.desc, category: rest.length ? category : '', text, color: colors.get(category) || DEFAULT_ACTION_COLOR };
    });
}

export function dropdownItems(valueKind: string | undefined, doc?: MapDoc | null, referenceTo?: Namer, nameOf?: Namer): DropdownItem[] {
  if (!valueKind) return [];
  if (valueKind === TRIGGER_TYPE_KIND) return actionItems();
  const values = TABLE?.values || {};
  const base = valueKind.split(KIND_SEPARATOR)[0] ?? '';
  const merged = { ...(base !== valueKind ? values[base] : null), ...values[valueKind] };
  const items: DropdownItem[] = [];
  const picture = Object.hasOwn(PICTURES, valueKind) ? PICTURES[valueKind] : undefined;
  for (const [value, label] of Object.entries(merged)) {
    if (value.includes(CUSTOM_VALUE_MARK)) items.push({ custom: true, label, negative: value.startsWith(NEGATIVE_MARK) });
    else items.push({ value, label, ...(picture ? { picture: picture(value) } : {}) });
  }
  const kinds = pickKindsOf(valueKind);
  if (kinds && doc && referenceTo && nameOf) {
    for (const item of doc.elements) if (kinds.includes(item.tag)) items.push({ value: referenceTo(doc, item), label: nameOf(doc, item), icon: item.tag });
  }
  return items;
}

export const actionCategories = (): ActionCategory[] => TABLE?.categories || [];
