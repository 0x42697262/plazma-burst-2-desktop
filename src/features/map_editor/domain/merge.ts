import { isNumberReference, isUidReference, referenceKindOf } from '#features/triggers/logic/graph.ts';
import { DECIMAL_RADIX, REFERENCES_SHOWN } from './constants.ts';
import { boundsOf, kindOf, NOT_PLACED, tidy } from './kinds.ts';
import { newElement, parseMap, type AttrValues, type Attrs, type MapDoc, type MapElement, type Spot } from './doc.ts';
import { AXES, PLACE_ATTRS, SHIFTED_ATTRS, SHIFTED_WITH_PLACE, UID_ATTR, uidPrefix } from './keys.ts';
import { DOMAIN_TEXT as TEXT } from './text.ts';

export type Placement = { offset?: Spot; at?: Spot } | null;
export type LoadOptions = { add: boolean; sync: boolean; only: ReadonlySet<string> | null; placement: Placement; mapNumbers: boolean };
export type Reference = { from: string; attr: string; value: string };
export type Replacement = { target: MapElement; values: AttrValues };
export type Skipped = { name: string; why: string };
export type LoadPlan = {
  replace: Replacement[];
  add: MapElement[];
  remove: MapElement[];
  same: MapElement[];
  skipped: Skipped[];
  renamed: [string, string][];
  dangling: Reference[];
};

type Incoming = { tag: string; attrs: Attrs };

const titleOf = (tag: string): string => kindOf(tag)?.title ?? tag;
const nameOf = (item: Incoming): string => item.attrs.uid || titleOf(item.tag);

function referencesOf(item: Incoming): { attr: string; value: string }[] {
  return Object.entries(item.attrs)
    .filter(([attr]) => referenceKindOf(item.attrs, attr) !== undefined)
    .map(([attr, value]) => ({ attr, value }));
}

function refuseNumberReferences(items: readonly Incoming[]): void {
  const found = items.flatMap((item) => referencesOf(item)
    .filter(({ value }) => isNumberReference(value))
    .map(({ attr, value }) => TEXT.referenceAt(nameOf(item), attr, value)));
  if (found.length) throw new Error(TEXT.numberReferences(found.slice(0, REFERENCES_SHOWN), Math.max(0, found.length - REFERENCES_SHOWN)));
}

function refuseSameUidTwice(items: readonly Incoming[]): void {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const { attrs } of items) {
    if (!attrs.uid) continue;
    if (seen.has(attrs.uid)) twice.add(attrs.uid);
    seen.add(attrs.uid);
  }
  if (twice.size) throw new Error(TEXT.sameUidTwice([...twice]));
}

function shiftOf(items: readonly Incoming[], placement: Placement): Spot | null {
  if (placement?.offset) return placement.offset;
  if (!placement?.at) return null;
  let left = Infinity;
  let top = Infinity;
  for (const item of items) {
    const bounds = boundsOf(item);
    if (!bounds) continue;
    left = Math.min(left, bounds.x);
    top = Math.min(top, bounds.y);
  }
  const { at } = placement;
  return Number.isFinite(left) ? { x: at.x - left, y: at.y - top } : null;
}

function shifted(item: Incoming, by: Spot): void {
  const extra = Object.hasOwn(SHIFTED_WITH_PLACE, item.tag) ? SHIFTED_WITH_PLACE[item.tag] : undefined;
  for (const axis of AXES) {
    for (const attr of [...SHIFTED_ATTRS[axis], ...(extra?.[axis] ?? [])]) {
      const value = item.attrs[attr];
      if (value === undefined || value === '' || !Number.isFinite(Number(value))) continue;
      item.attrs[attr] = tidy(Number(value) + by[axis]);
    }
  }
}

function freshUid(tag: string, taken: Set<string>): string {
  const prefix = uidPrefix(tag);
  let highest = 0;
  for (const uid of taken) if (uid.startsWith(prefix)) highest = Math.max(highest, parseInt(uid.slice(prefix.length), DECIMAL_RADIX) || 0);
  const uid = prefix + String(highest + 1);
  taken.add(uid);
  return uid;
}

function renameTaken(items: readonly Incoming[], doc: MapDoc): Map<string, string> {
  const taken = new Set([...doc.elements, ...items].map((item) => item.attrs.uid).filter((uid): uid is string => !!uid));
  const renamed = new Map<string, string>();
  for (const item of items) {
    const uid = item.attrs.uid;
    if (!uid || !doc.byUid(uid)) continue;
    const fresh = freshUid(item.tag, taken);
    renamed.set(uid, fresh);
    item.attrs.uid = fresh;
  }
  for (const item of items) {
    for (const { attr, value } of referencesOf(item)) {
      const fresh = renamed.get(value);
      if (fresh) item.attrs[attr] = fresh;
    }
  }
  return renamed;
}

function danglingOf(items: readonly Incoming[], doc: MapDoc): Reference[] {
  const inFile = new Set(items.map((item) => item.attrs.uid).filter(Boolean));
  return items.flatMap((item) => referencesOf(item)
    .filter(({ value }) => isUidReference(value) && !inFile.has(value) && !doc.byUid(value))
    .map(({ attr, value }) => ({ from: nameOf(item), attr, value })));
}

function differences(target: MapElement, wanted: Attrs): AttrValues {
  const values: AttrValues = {};
  for (const attr of new Set([...Object.keys(target.attrs), ...Object.keys(wanted)])) {
    const keepsItsPlace = !(attr in wanted) && PLACE_ATTRS.includes(attr);
    if (keepsItsPlace || target.attrs[attr] === wanted[attr]) continue;
    values[attr] = wanted[attr];
  }
  return values;
}

const sameAttrs = (first: Attrs, second: Attrs): boolean => {
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every((key) => first[key] === second[key]);
};

export function planLoad(doc: MapDoc, text: string, options: LoadOptions): LoadPlan {
  const plan: LoadPlan = { replace: [], add: [], remove: [], same: [], skipped: [], renamed: [], dangling: [] };
  const parsed = parseMap(text).elements;
  if (!parsed.length) throw new Error(TEXT.nothingToLoad);
  const items: Incoming[] = [];
  for (const { tag, attrs } of parsed) {
    if (!kindOf(tag)) plan.skipped.push({ name: TEXT.tagName(tag), why: TEXT.unknownKind(tag) });
    else if (NOT_PLACED.has(tag)) plan.skipped.push({ name: titleOf(tag), why: TEXT.notLoaded(titleOf(tag)) });
    else if (!options.only || options.only.has(tag)) items.push({ tag, attrs: { ...attrs } });
  }
  refuseSameUidTwice(items);
  if (!options.mapNumbers) refuseNumberReferences(items);
  const by = shiftOf(items, options.placement);
  if (by) for (const item of items) shifted(item, by);
  if (options.add) plan.renamed = [...renameTaken(items, doc)];
  plan.dangling = danglingOf(items, doc);
  const matched = new Set<MapElement>();
  for (const item of items) {
    const uid = item.attrs[UID_ATTR];
    const twin = (): MapElement | null => doc.elements.find((other) => other.tag === item.tag && !matched.has(other) && sameAttrs(other.attrs, item.attrs)) ?? null;
    const target = options.add ? null : uid ? doc.byUid(uid) : twin();
    if (!target) {
      plan.add.push(newElement(item.tag, item.attrs));
      continue;
    }
    if (target.tag !== item.tag) {
      plan.skipped.push({ name: nameOf(item), why: TEXT.otherKind(uid ?? '', titleOf(target.tag)) });
      continue;
    }
    matched.add(target);
    const values = differences(target, item.attrs);
    if (Object.keys(values).length) plan.replace.push({ target, values });
    else plan.same.push(target);
  }
  if (options.sync && !options.add) {
    const kinds = new Set(items.map((item) => item.tag));
    plan.remove = doc.elements.filter((other) => kinds.has(other.tag) && !matched.has(other));
  }
  return plan;
}
