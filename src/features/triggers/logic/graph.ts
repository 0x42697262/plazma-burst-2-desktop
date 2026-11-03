import { game } from '#console/kernel/game/bindings.ts';
import { ACTION, ACTION_NAMES, RUNS_REGION_TRIGGER } from '#console/kernel/game/actions.ts';
import { MAP_MARKER } from '#shared/contract/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { triggerList, regionList } from '../model.ts';
import { actionInfo } from '../script.ts';
import { HALF, UNPLACED_ABOVE, UNPLACED_STEP } from './constants.ts';
import {
  ACTION_ATTR, ATTACH_ATTR, ATTR, ATTR_KIND, CHARACTER_KIND, CHARACTER_TAGS, INDEX_QUERY, LINK, NUMBERED, REGION_TAG, STARTING_ATTRS, TAG, TARGET_A_SUFFIX,
  TARGET_KIND, TIMER_KIND, TRIGGER_KIND, UID_ATTR, UID_MARK, UNPLACED_TAGS, USES_TIMER_ATTR, USES_TIMER_VALUES, USE_TARGET_ATTR, WHOLE, nameless, typeAttr,
  type LinkKind,
} from './keys.ts';
import { TEXT } from './text.ts';

export { LINK, nameless };

export type Attributes = Record<string, string>;
export type GraphNode = {
  uid: string; named: boolean; tag: string; index: number; character: number | undefined;
  x: number | undefined; y: number | undefined; w: number | undefined; h: number | undefined; attrs: Attributes;
};
export type Link = { from: GraphNode; to: GraphNode; kind: LinkKind; label: string };
export type Graph = {
  nodes: GraphNode[];
  byUid: Map<string, GraphNode>;
  byIndex: Map<string, GraphNode[]>;
  links: Link[];
  into: Map<string, Link[]>;
  outOf: Map<string, Link[]>;
};
export type Place = { x: number | undefined; y: number | undefined; w?: number | undefined; h?: number | undefined };
type Item = { tag: string; attrs: Attributes; node?: GraphNode | null };

const STARTS: ReadonlySet<number> = new Set([ACTION.RUN_TRIGGER, ACTION.JUMP_TO_TRIGGER, ...RUNS_REGION_TRIGGER]);
const CONTROLS: ReadonlySet<number> = new Set([ACTION.DISABLE_TRIGGER, ACTION.ENABLE_TRIGGER, ACTION.ENABLE_TIMER, ACTION.DISABLE_TIMER]);

const finiteOf = (text: string | undefined): number | undefined => (text !== undefined && Number.isFinite(Number(text)) ? Number(text) : undefined);

export function unplacedSpots<Entry extends Item>(items: readonly Entry[]): Map<Entry, { x: number; y: number }> {
  let left = Infinity;
  let top = Infinity;
  for (const { attrs } of items) {
    const placedX = finiteOf(attrs.x);
    const placedY = finiteOf(attrs.y);
    if (placedX !== undefined) left = Math.min(left, placedX);
    if (placedY !== undefined) top = Math.min(top, placedY);
  }
  if (!Number.isFinite(left)) left = 0;
  if (!Number.isFinite(top)) top = 0;
  const spots = new Map<Entry, { x: number; y: number }>();
  for (const item of items) {
    const isUnplaced = UNPLACED_TAGS.has(item.tag) && (item.attrs.x === undefined || item.attrs.y === undefined);
    if (isUnplaced) spots.set(item, { x: left + UNPLACED_STEP * spots.size, y: top - UNPLACED_ABOVE });
  }
  return spots;
}

const linkKindOfAttr = (attr: string): LinkKind => (STARTING_ATTRS.has(attr) ? LINK.START : attr === ATTACH_ATTR ? LINK.ATTACH : LINK.REF);
const linkKindOfAction = (type: number): LinkKind => (STARTS.has(type) ? LINK.START : CONTROLS.has(type) ? LINK.CONTROL : LINK.ACT);
export const actionLabel = (action: number, type: number): string => TEXT.actionLabel(action, type, ACTION_NAMES[type]);

export function referenceKindOf(attrs: Attributes, attr: string): string | undefined {
  if (attr === UID_ATTR) return undefined;
  const action = ACTION_ATTR.exec(attr)?.[1];
  if (action !== undefined) {
    const info = actionInfo(Number(attrs[typeAttr(action)]));
    const kind = attr.endsWith(TARGET_A_SUFFIX) ? info?.a : info?.b;
    return kind === undefined ? undefined : TARGET_KIND[kind];
  }
  const usesTimer = attr === USE_TARGET_ATTR && USES_TIMER_VALUES.has(attrs[USES_TIMER_ATTR] ?? '');
  return usesTimer ? TIMER_KIND : ATTR_KIND[attr];
}

export const isUidReference = (value: string): boolean => value.startsWith(UID_MARK);
export const isNumberReference = (value: string): boolean => WHOLE.test(value);

function attributesOf(text: string): Attributes {
  const attrs: Attributes = {};
  for (const attribute of text.matchAll(ATTR)) attrs[attribute[1] ?? ''] = attribute[2] ?? '';
  return attrs;
}

export function buildGraph(text: string): Graph {
  const nodes: GraphNode[] = [];
  const elements: Item[] = [];
  const byUid = new Map<string, GraphNode>();
  const byIndex = new Map<string, GraphNode[]>();
  const perTag: Record<string, number> = {};
  let characters = 0;
  const indexed = (kind: string): GraphNode[] => {
    const list = byIndex.get(kind) ?? [];
    byIndex.set(kind, list);
    return list;
  };
  for (const match of text.matchAll(TAG)) {
    const tag = match[1] ?? '';
    const attrs = attributesOf(match[2] ?? '');
    const index = perTag[tag] = (perTag[tag] ?? -1) + 1;
    const character = CHARACTER_TAGS.has(tag) ? characters++ : undefined;
    const item: Item = { tag, attrs, node: null };
    elements.push(item);
    if (!attrs.uid && !NUMBERED.has(tag)) continue;
    const uid = attrs.uid || nameless(tag, index);
    const node: GraphNode = {
      uid, named: !!attrs.uid, tag, index, character,
      x: attrs.x === undefined ? undefined : Number(attrs.x), y: attrs.y === undefined ? undefined : Number(attrs.y),
      w: attrs.w === undefined ? undefined : Number(attrs.w), h: attrs.h === undefined ? undefined : Number(attrs.h), attrs,
    };
    nodes.push(node);
    item.node = node;
    if (!byUid.has(uid)) byUid.set(uid, node);
    indexed(tag)[index] = node;
    if (character !== undefined) indexed(CHARACTER_KIND)[character] = node;
  }
  for (const [item, spot] of unplacedSpots(elements)) if (item.node) Object.assign(item.node, spot);
  const target = (value: string, kind: string | undefined): GraphNode | null => {
    const named = byUid.get(value);
    if (named && value.startsWith(UID_MARK)) return named;
    if (!kind || !WHOLE.test(value)) return null;
    return byIndex.get(kind)?.[Number(value)] ?? null;
  };
  const links: Link[] = [];
  for (const from of nodes) {
    for (const [attr, value] of Object.entries(from.attrs)) {
      if (attr === UID_ATTR) continue;
      const to = target(value, referenceKindOf(from.attrs, attr));
      if (!to || to === from) continue;
      const action = ACTION_ATTR.exec(attr)?.[1];
      if (action === undefined) {
        links.push({ from, to, kind: linkKindOfAttr(attr), label: attr });
        continue;
      }
      const type = Number(from.attrs[typeAttr(action)]);
      links.push({ from, to, kind: linkKindOfAction(type), label: actionLabel(Number(action), type) });
    }
  }
  const into = new Map<string, Link[]>();
  const outOf = new Map<string, Link[]>();
  const listIn = (map: Map<string, Link[]>, uid: string): Link[] => {
    const list = map.get(uid) ?? [];
    map.set(uid, list);
    return list;
  };
  for (const link of links) {
    listIn(into, link.to.uid).push(link);
    listIn(outOf, link.from.uid).push(link);
  }
  return { nodes, byUid, byIndex, links, into, outOf };
}

let builtFor: string | null = null;
let graph: Graph | null = null;

export function logicGraph(): Graph | null {
  const text = game.mapText();
  if (typeof text !== 'string' || !text || text.startsWith(MAP_MARKER.compressedPrefix)) return null;
  if (text !== builtFor) {
    builtFor = text;
    graph = buildGraph(text);
  }
  return graph;
}

export function findNode(found: Graph, query: unknown): GraphNode | null {
  const lowered = stringOf(query).toLowerCase();
  const byName = found.nodes.find((node) => node.uid.toLowerCase() === lowered);
  if (byName) return byName;
  const index = INDEX_QUERY.test(lowered) ? Number(lowered.replace(UID_MARK, '')) : -1;
  if (index < 0) return null;
  const trigger = triggerList()[index];
  return (trigger?.uid ? found.byUid.get(trigger.uid) : undefined) ?? found.byIndex.get(TRIGGER_KIND)?.[index] ?? null;
}

export function placeOf(node: GraphNode): Place {
  if (node.tag === REGION_TAG) {
    const region = regionList()[node.index];
    if (region && Number.isFinite(region.x)) return { x: region.x as number, y: region.y as number, w: region.w as number, h: region.h as number };
  }
  if (node.character !== undefined) {
    const character = game.chars()[node.character];
    if (character?.io && Number.isFinite(character.x)) return { x: character.x, y: character.y };
  }
  return { x: node.x, y: node.y, w: node.w, h: node.h };
}

export const centerOf = (place: Place): { x: number; y: number } => ({
  x: (place.x ?? Number.NaN) + (Number.isFinite(place.w) ? (place.w as number) / HALF : 0),
  y: (place.y ?? Number.NaN) + (Number.isFinite(place.h) ? (place.h as number) / HALF : 0),
});

export function chatTriggerUid(): string | null {
  const index = game.sayTrigger();
  const trigger = typeof index === 'number' && index >= 0 ? triggerList()[index] : null;
  return trigger?.uid ?? null;
}
