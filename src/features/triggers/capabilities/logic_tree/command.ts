import { print } from '#console/kernel/ui/log.ts';
import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { LINK, chatTriggerUid, type GraphNode, type Link } from '../../logic/graph.ts';
import { isVisible } from '../../logic/view.ts';
import type { LinkKind } from '../../logic/keys.ts';
import { LOGIC_DEPTH } from '../../entry/constants.ts';
import { ACTION_LABEL, FROM_END, INDENT, LOGIC_COMMAND, SPACE, TO_END } from '../../entry/keys.ts';
import { TEXT } from './text.ts';
import { requireGraph, takeDepth, requireNode, takeFilters, nameOf, whereOf } from '../../logic/query.ts';
import { COMMAND } from './keys.ts';

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
  showPaged({ title: TEXT.treeTitle(depth, describe), color: COLOR.hint, rows, cmd: TEXT.treeCommand(node.uid), page });
}

export const logicTreeCommand = Object.freeze({
  parent: LOGIC_COMMAND.name,
  name: COMMAND.name,
  usage: TEXT.tree.usage,
  desc: TEXT.tree.desc,
  help: { about: TEXT.tree.about, args: TEXT.tree.args, examples: TEXT.tree.examples, see: TEXT.tree.see },
  run: (args: string[]) => { tree(args); },
});
