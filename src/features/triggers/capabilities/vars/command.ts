import { showPaged, takePage } from '#console/kernel/ui/pager.ts';
import { showTarget } from '../../model.ts';
import { requireVars } from '../../vars.ts';
import { VAR_NAME_WIDTH } from '../../entry/constants.ts';
import { SPACE, VARS_COMMAND } from '../../entry/keys.ts';
import { TEXT } from './text.ts';

function listVars(rawArgs: readonly string[]): void {
  const vars = requireVars();
  const { args, page } = takePage(rawArgs);
  const names = Object.keys(vars).sort();
  const filter = args.join(SPACE).trim();
  const lowered = filter.toLowerCase();
  const rows = names.filter((name) => !lowered || name.toLowerCase().includes(lowered)).map((name) => [TEXT.row(name.padEnd(VAR_NAME_WIDTH), showTarget(vars[name]))] as const);
  showPaged({
    title: TEXT.title(names.length, filter, rows.length),
    rows,
    cmd: TEXT.command(filter),
    empty: names.length ? TEXT.noMatch(filter) : TEXT.noneYet,
    hint: TEXT.listHint,
    page,
  });
}

export const varsCommand = Object.freeze({
  parent: VARS_COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.desc,
  clientOnly: TEXT.clientOnly,
  help: TEXT.help,
  run: (args: string[]) => { listVars(args); },
});
