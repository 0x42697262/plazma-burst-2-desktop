import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { opcodesLoaded, searchActions } from '../../script.ts';
import { ALIAS_WIDTH, TYPE_WIDTH } from '../../entry/constants.ts';
import { SPACE, TRIGGERS_COMMAND } from '../../entry/keys.ts';
import { HELP, TEXT } from './text.ts';
import { COMMAND } from './keys.ts';

function listActions(rawArgs: readonly string[]): void {
  if (!opcodesLoaded()) throw new Error(TEXT.noOpcodes);
  const { args, page } = takePage(rawArgs);
  const query = args.join(SPACE).trim();
  const hits = searchActions(query);
  const rows: Row[] = hits.map((action) => [TEXT.actionsRow(String(action.type).padStart(TYPE_WIDTH), (action.alias || TEXT.opName(action.type)).padEnd(ALIAS_WIDTH), action.desc, action.a, action.b)]);
  showPaged({ title: TEXT.actionsTitle2(query, hits.length), rows, cmd: TEXT.actionsCommand(query), empty: TEXT.actionsNoMatch(query), page });
}

export const actionsCommand = Object.freeze({
  parent: TRIGGERS_COMMAND.name,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: HELP.usage,
  desc: HELP.desc,
  help: { about: HELP.about, args: HELP.args, examples: HELP.examples, see: HELP.see },
  run: (args: string[]) => { listActions(args); },
});
