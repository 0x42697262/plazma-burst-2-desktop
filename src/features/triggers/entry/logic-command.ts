import { print } from '#console/kernel/ui/log.ts';
import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { requireLevel } from '#console/kernel/game/level.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import type { CommandDefinition } from '#console/kernel/commands/registry.ts';
import { LINK, logicGraph, findNode, placeOf, chatTriggerUid, type Graph, type GraphNode, type Link } from '../logic/graph.ts';
import { showLogic, hideLogic, logicShown, isVisible } from '../logic/view.ts';
import type { LinkKind } from '../logic/keys.ts';
import { DEPTH_WORDS, LOGIC_DEPTH } from './constants.ts';
import {
  ACTION_LABEL, DEPTH_WORD, FROM_END, INDENT, LIST_SEPARATOR, LOGIC_COMMAND, NOT_PREFIX, PLURAL_ENDINGS, SCREEN_WORDS, SPACE, TO_END, TYPE_PREFIX,
} from './keys.ts';
import { LOGIC_TEXT as TEXT } from './text.ts';

type Filters = { args: string[]; typeOk: (node: GraphNode) => boolean; kindOk: (link: Link) => boolean; screen: boolean; describe: string; filtered: boolean };

const KINDS: readonly string[] = Object.values(LINK);

function requireGraph(): Graph {
  requireLevel();
  const graph = logicGraph();
  if (!graph) throw new Error(TEXT.notReadable);
  return graph;
}

function takeDepth(args: readonly string[], fallback: number): { args: string[]; depth: number } {
  const at = args.findIndex((arg) => arg.toLowerCase() === DEPTH_WORD);
  if (at === -1) return { args: [...args], depth: fallback };
  const depth = Number(args[at + 1]);
  if (!Number.isInteger(depth) || depth < 1 || depth > LOGIC_DEPTH.max) throw new Error(TEXT.depthRange(LOGIC_DEPTH.max));
  return { args: [...args.slice(0, at), ...args.slice(at + DEPTH_WORDS)], depth };
}

function requireNode(graph: Graph, query: string): GraphNode {
  const node = findNode(graph, query);
  if (!node) throw new Error(TEXT.nothingCalled(query));
  return node;
}

function typesIn(graph: Graph): [string, number][] {
  const counts = new Map<string, number>();
  for (const node of graph.nodes) counts.set(node.tag, (counts.get(node.tag) ?? 0) + 1);
  return [...counts].sort((first, second) => second[1] - first[1]);
}

const typeList = (graph: Graph): string => typesIn(graph).map(([type, count]) => TEXT.typeCount(type, count)).join(TEXT.listSeparator);

function resolveType(graph: Graph, word: string): string {
  const lowered = word.toLowerCase();
  const tags = new Set(graph.nodes.map((node) => node.tag));
  const tag = [lowered, ...PLURAL_ENDINGS.map((ending) => lowered.replace(ending, ''))].find((candidate) => tags.has(candidate));
  if (!tag) throw new Error(TEXT.noType(word, typeList(graph)));
  return tag;
}

function takeFilters(graph: Graph, args: readonly string[]): Filters {
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

const nameOf = (node: GraphNode): string => TEXT.name(node.uid, node.tag, node.index);
function whereOf(node: GraphNode): string {
  const place = placeOf(node);
  return Number.isFinite(place.x) ? TEXT.at(Math.round(place.x as number), Math.round(place.y as number)) : '';
}

function around(graph: Graph, node: GraphNode, depth: number, keep: (link: Link) => boolean): Set<Link> {
  const links = new Set<Link>();
  let ring = [node];
  const seen = new Set<GraphNode>(ring);
  for (let step = 0; step < depth && ring.length; step++) {
    const next: GraphNode[] = [];
    for (const current of ring) {
      for (const link of [...(graph.outOf.get(current.uid) ?? []), ...(graph.into.get(current.uid) ?? [])]) {
        if (!keep(link)) continue;
        links.add(link);
        for (const other of [link.from, link.to]) {
          if (seen.has(other)) continue;
          seen.add(other);
          next.push(other);
        }
      }
    }
    ring = next;
  }
  return links;
}

function show(rawArgs: readonly string[]): void {
  const graph = requireGraph();
  const { args: rest, depth } = takeDepth(rawArgs, LOGIC_DEPTH.show);
  const { args, typeOk, kindOk, screen, describe } = takeFilters(graph, rest);
  const target = args.join(SPACE);
  const node = target ? requireNode(graph, target) : null;
  const ends = (candidate: GraphNode): boolean => candidate === node || typeOk(candidate);
  const keep = (link: Link): boolean => kindOk(link) && ends(link.from) && ends(link.to);
  const near = node ? around(graph, node, depth, keep) : null;
  const filter = (link: Link): boolean => keep(link) && (!near || near.has(link));
  const where = node ? TEXT.around(node.uid, depth) : TEXT.wholeMap;
  showLogic(filter, { screen, describe: TEXT.showDescribe(screen, where, describe) });
  if (screen) {
    const visibleNow = graph.links.filter((link) => filter(link) && isVisible(link.from) && isVisible(link.to)).length;
    print(TEXT.showingScreen(where, describe, plural(visibleNow, TEXT.linkNoun)), COLOR.ok);
  } else {
    print(TEXT.showing(plural(graph.links.filter(filter).length, TEXT.linkNoun), where, describe), COLOR.ok);
  }
  print(TEXT.colours, COLOR.hint);
  print(TEXT.crosshair, COLOR.hint);
}

function mergedLabel(links: readonly Link[]): string {
  const parts = links.map((link) => ACTION_LABEL.exec(link.label));
  const [first] = parts;
  const isSameAction = links.length > 1 && !!first && parts.every((part) => part && part[2] === first[2]);
  if (isSameAction) return TEXT.mergedActions(parts.map((part) => part?.[1] ?? ''), first[2] ?? '');
  return links.map((link) => link.label).join(TEXT.labelSeparator);
}

function groupBy(links: readonly Link[], end: typeof FROM_END | typeof TO_END): [GraphNode, Link[]][] {
  const groups = new Map<GraphNode, Link[]>();
  for (const link of links) {
    const node = link[end];
    const group = groups.get(node) ?? [];
    group.push(link);
    groups.set(node, group);
  }
  return [...groups];
}

const startsSomething = (links: readonly Link[]): boolean => links.some((link) => link.kind === (LINK.START as LinkKind));

function tree(rawArgs: readonly string[]): void {
  const graph = requireGraph();
  const { args: rest, depth } = takeDepth(rawArgs, LOGIC_DEPTH.tree);
  const { args: unpaged, page } = takePage(rest);
  const { args, typeOk, kindOk, screen, describe, filtered } = takeFilters(graph, unpaged);
  if (!args.length) throw new Error(TEXT.treeUsage);
  const node = requireNode(graph, args.join(SPACE));
  const keepRow = (link: Link, other: GraphNode): boolean => kindOk(link) && typeOk(other) && (!screen || isVisible(other));
  const chat = chatTriggerUid();
  const rows: Row[] = [];
  const back = (current: GraphNode, level: number, path: ReadonlySet<GraphNode>): void => {
    if (current.uid === chat) rows.push([TEXT.chatRow(INDENT.repeat(level)), COLOR.title]);
    for (const [from, links] of groupBy((graph.into.get(current.uid) ?? []).filter((link) => keepRow(link, link.from)), FROM_END)) {
      const shown = level > 1 ? links.filter((link) => link.kind === LINK.START) : links;
      if (!shown.length) continue;
      const isLoop = path.has(from);
      rows.push([TEXT.backRow(INDENT.repeat(level), nameOf(from), mergedLabel(shown), isLoop), startsSomething(shown) ? undefined : COLOR.hint]);
      if (!isLoop && level < depth && startsSomething(shown)) back(from, level + 1, new Set(path).add(from));
    }
  };
  print(nameOf(node) + whereOf(node), COLOR.title);
  rows.push([TEXT.reachedFrom, COLOR.title]);
  back(node, 1, new Set([node]));
  if (rows.length === 1) rows.push([filtered ? TEXT.nothingFiltered(INDENT, describe) : TEXT.nothingInMap(INDENT), COLOR.notice]);
  const out = groupBy((graph.outOf.get(node.uid) ?? []).filter((link) => keepRow(link, link.to)), TO_END);
  rows.push([out.length ? TEXT.actsOn : TEXT.actsOnNothing, COLOR.title]);
  for (const [to, links] of out) rows.push([TEXT.outRow(INDENT, nameOf(to), mergedLabel(links)), startsSomething(links) ? undefined : COLOR.hint]);
  showPaged({ title: TEXT.treeTitle(depth, describe, node.uid), color: COLOR.hint, rows, cmd: TEXT.treeCommand(node.uid), page });
}

function status(): void {
  const graph = logicGraph();
  const summary = graph ? TEXT.statusSummary(plural(graph.nodes.length, TEXT.elementNoun), plural(graph.links.length, TEXT.linkNoun)) : TEXT.statusEnd;
  print(TEXT.status(logicShown(), summary), COLOR.title);
  if (graph) print(TEXT.types(typeList(graph)), COLOR.hint);
  print(TEXT.statusHint, COLOR.hint);
}

export const logicCommand: CommandDefinition = {
  name: LOGIC_COMMAND.name,
  aliases: LOGIC_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: TEXT.help,
  run: (args) => {
    if (args.length) tree(args);
    else status();
  },
  subcommands: [
    {
      name: LOGIC_COMMAND.show,
      aliases: LOGIC_COMMAND.showAliases,
      usage: TEXT.show.usage,
      desc: TEXT.show.desc,
      help: {
        about: [...TEXT.show.about, ...(REMOTE ? [] : TEXT.show.antiCheatNote)],
        args: TEXT.show.args, examples: TEXT.show.examples, notes: TEXT.show.notes, see: TEXT.show.see,
      },
      run: (args) => { show(args); },
    },
    {
      name: LOGIC_COMMAND.hide,
      aliases: LOGIC_COMMAND.hideAliases,
      usage: TEXT.hide.usage,
      desc: TEXT.hide.desc,
      help: { about: TEXT.hide.about, see: TEXT.hide.see },
      run: () => {
        hideLogic();
        print(TEXT.hidden, COLOR.ok);
      },
    },
    {
      name: LOGIC_COMMAND.tree,
      usage: TEXT.tree.usage,
      desc: TEXT.tree.desc,
      help: { about: TEXT.tree.about, args: TEXT.tree.args, examples: TEXT.tree.examples, see: TEXT.tree.see },
      run: (args) => { tree(args); },
    },
  ],
};
