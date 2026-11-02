import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import { type Graph, type GraphNode, type Link } from '../../logic/graph.ts';
import { showLogic, hideLogic, isVisible } from '../../logic/view.ts';
import { LOGIC_DEPTH } from '../../entry/constants.ts';
import { LOGIC_COMMAND, SPACE } from '../../entry/keys.ts';
import { TEXT } from './text.ts';
import { requireGraph, takeDepth, requireNode, takeFilters } from '../../logic/query.ts';
import { QUERY_TEXT as SHARED } from '../../logic/text.ts';
import { COMMAND } from './keys.ts';

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
    print(TEXT.showingScreen(where, describe, plural(visibleNow, SHARED.linkNoun)), COLOR.ok);
  } else {
    print(TEXT.showing(plural(graph.links.filter(filter).length, SHARED.linkNoun), where, describe), COLOR.ok);
  }
  print(TEXT.colors, COLOR.hint);
  print(TEXT.crosshair, COLOR.hint);
}

export const logicShowCommands = Object.freeze([
  {
    parent: LOGIC_COMMAND.name,
    name: COMMAND.show,
    aliases: COMMAND.showAliases,
    usage: TEXT.show.usage,
    desc: TEXT.show.desc,
    help: {
      about: [...TEXT.show.about, ...(REMOTE ? [] : TEXT.show.antiCheatNote)],
      args: TEXT.show.args, examples: TEXT.show.examples, notes: TEXT.show.notes, see: TEXT.show.see,
    },
    run: (args: string[]) => { show(args); },
  },
  {
    parent: LOGIC_COMMAND.name,
    name: COMMAND.hide,
    aliases: COMMAND.hideAliases,
    usage: TEXT.hide.usage,
    desc: TEXT.hide.desc,
    help: { about: TEXT.hide.about, see: TEXT.hide.see },
    run: () => {
      hideLogic();
      print(TEXT.hidden, COLOR.ok);
    },
  },
]);
