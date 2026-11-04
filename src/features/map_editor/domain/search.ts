import { referenceKindOf } from '#features/triggers/logic/graph.ts';
import { opcodeName } from '#features/triggers/script.ts';
import { actionsOf } from './actions.ts';
import { kindOf, nameOf } from './kinds.ts';
import { QUERY_FIELD, QUERY_PREFIX, QUERY_WORD, SEARCHED_ATTRS, SEARCH_JOIN, SORT_OPTIONS, opWord } from './keys.ts';
import type { MapDoc, MapElement } from './doc.ts';

export type Query = { general: string[]; kind: string[]; op: string[]; ref: string[] };

export function parseQuery(text: string): Query {
  const query: Query = { general: [], kind: [], op: [], ref: [] };
  for (const match of text.trim().matchAll(QUERY_WORD)) {
    const word = (match[1] ?? match[2] ?? match[3] ?? '').trim().toLowerCase();
    if (!word) continue;
    const field = QUERY_FIELD.exec(word);
    const value = field?.[2]?.trim() ?? '';
    if (!field || !value) query.general.push(word);
    else if (field[1] === QUERY_PREFIX.type) query.kind.push(value);
    else if (field[1] === QUERY_PREFIX.op) query.op.push(value);
    else query.ref.push(value);
  }
  return query;
}

export const isEmptyQuery = (query: Query): boolean => !query.general.length && !query.kind.length && !query.op.length && !query.ref.length;

function haystacks(doc: MapDoc, item: MapElement): { kind: string; op: string; ref: string; all: string } {
  const kind = [item.tag, kindOf(item.tag)?.title ?? ''].join(SEARCH_JOIN).toLowerCase();
  const op = actionsOf(item.attrs).flatMap((action) => [opcodeName(Number(action.type)), opWord(action.type)]).join(SEARCH_JOIN).toLowerCase();
  const ref = Object.entries(item.attrs).filter(([attr]) => referenceKindOf(item.attrs, attr) !== undefined).map(([, value]) => value).join(SEARCH_JOIN).toLowerCase();
  const own = [nameOf(doc, item), String(doc.ordinal(item) ?? ''), ...SEARCHED_ATTRS.map((attr) => item.attrs[attr] ?? '')].join(SEARCH_JOIN).toLowerCase();
  return { kind, op, ref, all: [kind, op, ref, own].join(SEARCH_JOIN) };
}

export function matchesQuery(doc: MapDoc, item: MapElement, query: Query): boolean {
  if (isEmptyQuery(query)) return true;
  const hay = haystacks(doc, item);
  return query.general.every((word) => hay.all.includes(word)) && query.kind.every((word) => hay.kind.includes(word))
    && query.op.every((word) => hay.op.includes(word)) && query.ref.every((word) => hay.ref.includes(word));
}

export function sortedByName(doc: MapDoc, items: readonly MapElement[]): MapElement[] {
  return items.map((item) => ({ item, name: nameOf(doc, item) }))
    .sort((first, second) => first.name.localeCompare(second.name, undefined, SORT_OPTIONS) || (doc.ordinal(first.item) ?? 0) - (doc.ordinal(second.item) ?? 0))
    .map(({ item }) => item);
}
