import { showPaged, takePage } from '#console/kernel/ui/pager.ts';
import { COMMAND, SUBCOMMAND, WORD_SEPARATOR } from '../../keys.ts';
import { FIELD_NAME_WIDTH } from '../../constants.ts';
import { gameSave } from '../../adapters/game.ts';
import { fieldShown } from '../../domain/fields.ts';
import { TEXT } from './text.ts';

function listFields(rawArgs: readonly string[]): void {
  const { args, page } = takePage(rawArgs);
  const data = gameSave.saveData();
  const names = Object.keys(data).sort((first, second) => first.localeCompare(second));
  const filter = args.join(WORD_SEPARATOR).trim();
  const lowered = filter.toLowerCase();
  const rows = names.filter((name) => !lowered || name.toLowerCase().includes(lowered))
    .map((name) => [TEXT.row(name.padEnd(FIELD_NAME_WIDTH), fieldShown(name, data[name]))] as const);
  showPaged({
    title: TEXT.title(names.length, filter, rows.length),
    rows,
    cmd: TEXT.command(filter),
    empty: names.length ? TEXT.noMatch(filter) : TEXT.noneYet,
    hint: TEXT.hint,
    page,
  });
}

export const fieldsCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.fields,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: (args: string[]) => { listFields(args); },
});
