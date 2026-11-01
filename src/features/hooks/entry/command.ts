import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { NAME_WIDTH, STATUS_WIDTH } from '../constants.ts';
import { COMMAND, GLOBAL, STATUS } from '../keys.ts';
import { TEXT } from '../text.ts';

export type HookStatusRow = { name: string; status: string; error: string; multiplayer: boolean; description: string; functions: string[]; patches: number; errors: number; activeNow: boolean };
type HooksApi = { status(): HookStatusRow[] };

const STATE_COLOR: Readonly<Record<string, string>> = Object.freeze({ [STATUS.loaded]: COLOR.ok, [STATUS.disabled]: COLOR.muted, [STATUS.error]: COLOR.error });
const { command } = TEXT;

export const hooksApi = (): HooksApi | null => (Reflect.get(globalThis, GLOBAL) as HooksApi | undefined) ?? null;

function whatOf(row: HookStatusRow): string {
  const what: string[] = [];
  if (row.functions.length) what.push(command.hooksWhat(row.functions.join(TEXT.partSeparator)));
  if (row.patches) what.push(command.patches(row.patches));
  if (!row.multiplayer) what.push(command.offInMultiplayer);
  if (row.status === STATUS.loaded && !row.activeNow) what.push(command.paused);
  if (row.errors) what.push(command.errors(row.errors));
  return what.join(command.whatSeparator);
}

function listHooks(args: readonly string[]): void {
  if (args.length) throw new Error(command.usageError);
  const api = hooksApi();
  if (!api) {
    print(command.none, COLOR.notice);
    return;
  }
  const rows = api.status();
  print(command.title(rows.length), COLOR.title);
  for (const row of rows) {
    print(command.row(row.name.padEnd(NAME_WIDTH), row.status.padEnd(STATUS_WIDTH), whatOf(row)), STATE_COLOR[row.status]);
    if (row.description) print(command.detail(row.description), COLOR.hint);
    if (row.error) print(command.detail(row.error), COLOR.error);
  }
}

export const hooksCommand = Object.freeze({
  remote: false,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: command.usage,
  desc: command.desc,
  help: { about: command.about, examples: command.examples, notes: command.notes },
  run: listHooks,
});
