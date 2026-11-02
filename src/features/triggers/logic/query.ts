import { requireLevel } from '#console/kernel/game/level.ts';
import { LINK, logicGraph, findNode, placeOf, type Graph, type GraphNode, type Link } from './graph.ts';
import { DEPTH_WORDS, LOGIC_DEPTH } from '../entry/constants.ts';
import { DEPTH_WORD, LIST_SEPARATOR, NOT_PREFIX, PLURAL_ENDINGS, SCREEN_WORDS, TYPE_PREFIX } from '../entry/keys.ts';
import { QUERY_TEXT as TEXT } from './text.ts';

export type Filters = { args: string[]; typeOk: (node: GraphNode) => boolean; kindOk: (link: Link) => boolean; screen: boolean; describe: string; filtered: boolean };

export const KINDS: readonly string[] = Object.values(LINK);

export function requireGraph(): Graph {
  requireLevel();
  const graph = logicGraph();
  if (!graph) throw new Error(TEXT.notReadable);
  return graph;
}

export function takeDepth(args: readonly string[], fallback: number): { args: string[]; depth: number } {
  const at = args.findIndex((arg) => arg.toLowerCase() === DEPTH_WORD);
  if (at === -1) return { args: [...args], depth: fallback };
  const depth = Number(args[at + 1]);
  if (!Number.isInteger(depth) || depth < 1 || depth > LOGIC_DEPTH.max) throw new Error(TEXT.depthRange(LOGIC_DEPTH.max));
  return { args: [...args.slice(0, at), ...args.slice(at + DEPTH_WORDS)], depth };
}

export function requireNode(graph: Graph, query: string): GraphNode {
  const node = findNode(graph, query);
  if (!node) throw new Error(TEXT.nothingCalled(query));
  return node;
}

export function typesIn(graph: Graph): [string, number][] {
  const counts = new Map<string, number>();
  for (const node of graph.nodes) counts.set(node.tag, (counts.get(node.tag) ?? 0) + 1);
  return [...counts].sort((first, second) => second[1] - first[1]);
}

export const typeList = (graph: Graph): string => typesIn(graph).map(([type, count]) => TEXT.typeCount(type, count)).join(TEXT.listSeparator);

export function resolveType(graph: Graph, word: string): string {
  const lowered = word.toLowerCase();
  const tags = new Set(graph.nodes.map((node) => node.tag));
  const tag = [lowered, ...PLURAL_ENDINGS.map((ending) => lowered.replace(ending, ''))].find((candidate) => tags.has(candidate));
  if (!tag) throw new Error(TEXT.noType(word, typeList(graph)));
  return tag;
}

export function takeFilters(graph: Graph, args: readonly string[]): Filters {
  let screen = false;
  const kinds = new Set<string>();
  let only: Set<string> | null = null;
  const without = new Set<string>();
  const rest: string[] = [];
  const typesAfter = (word: string, prefix: string): string[] => word.slice(prefix.length).split(LIST_SEPARATOR).filter(Boolean).map((type) => resolveType(graph, type));
  for (const arg of args) {
    const word = arg.toLowerCase();
    if (KINDS.includes(word)) kinds.add(word);
    else if (SCREEN_WORDS.includes(word)) screen = true;
    else if (word.startsWith(TYPE_PREFIX)) {
      only ??= new Set();
      for (const type of typesAfter(word, TYPE_PREFIX)) only.add(type);
    } else if (word.startsWith(NOT_PREFIX)) {
      for (const type of typesAfter(word, NOT_PREFIX)) without.add(type);
    } else rest.push(arg);
  }
  const onlyTypes = only;
  const typeOk = (node: GraphNode): boolean => (!onlyTypes || onlyTypes.has(node.tag)) && !without.has(node.tag);
  const kindOk = (link: Link): boolean => !kinds.size || kinds.has(link.kind);
  const describe = [
    kinds.size ? [...kinds].join(TEXT.listSeparator) : TEXT.everyKind,
    onlyTypes ? TEXT.onlyTypes([...onlyTypes]) : '',
    without.size ? TEXT.notTypes([...without]) : '',
    screen ? TEXT.onScreen : '',
  ].filter(Boolean).join(TEXT.listSeparator);
  return { args: rest, typeOk, kindOk, screen, describe, filtered: kinds.size > 0 || !!onlyTypes || without.size > 0 || screen };
}

export const nameOf = (node: GraphNode): string => TEXT.name(node.uid, node.tag, node.index);

export function whereOf(node: GraphNode): string {
  const place = placeOf(node);
  return Number.isFinite(place.x) ? TEXT.at(Math.round(place.x as number), Math.round(place.y as number)) : '';
}
