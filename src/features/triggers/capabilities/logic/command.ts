import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { logicGraph } from '../../logic/graph.ts';
import { logicShown } from '../../logic/view.ts';
import { LOGIC_COMMAND } from '../../entry/keys.ts';
import { TEXT } from './text.ts';
import { typeList } from '../../logic/query.ts';
import { QUERY_TEXT as SHARED } from '../../logic/text.ts';
import { runTree } from '../../logic/tree-port.ts';

function status(): void {
  const graph = logicGraph();
  const summary = graph ? TEXT.statusSummary(plural(graph.nodes.length, TEXT.elementNoun), plural(graph.links.length, SHARED.linkNoun)) : TEXT.statusEnd;
  print(TEXT.status(logicShown(), summary), COLOR.title);
  if (graph) print(TEXT.types(typeList(graph)), COLOR.hint);
  print(TEXT.statusHint, COLOR.hint);
}

export const logicCommand = Object.freeze({
  parent: LOGIC_COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: TEXT.help,
  run: (args: string[]) => {
    if (args.length) runTree(args);
    else status();
  },
});
