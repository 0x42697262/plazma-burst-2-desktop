import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { agoText } from '#console/kernel/core/words.ts';
import { KILOBYTE, RUN_INDEX_WIDTH, RUN_NAME_COLUMN_WIDTH, RUN_OWNER_COLUMN_WIDTH, RUN_SIZE_COLUMN_WIDTH, SIZE_DECIMALS } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { usageError } from '../../text.ts';
import { listRuns, type RunEntry } from '../../adapters/wrapper-client.ts';
import { rememberRuns } from '../../services/run-list.ts';
import { RUNS_COMMAND } from './keys.ts';
import { RUNS_TEXT as TEXT } from './text.ts';

function ownerOf(entry: RunEntry): string {
  if (entry.current) return TEXT.owner.current;
  if (entry.mine) return TEXT.owner.mine;
  return entry.active ? TEXT.owner.active : TEXT.owner.ended;
}

function colorOfRun(entry: RunEntry): string {
  if (entry.current) return COLOR.ok;
  return entry.mine || entry.active ? COLOR.plain : COLOR.muted;
}

function printRuns(list: RunEntry[]): void {
  rememberRuns(list);
  if (!list.length) {
    print(TEXT.none, COLOR.notice);
    return;
  }
  const now = Date.now();
  print(TEXT.title(list.length), COLOR.title);
  list.forEach((entry, index) => {
    const size = TEXT.size((entry.size / KILOBYTE).toFixed(SIZE_DECIMALS));
    print(TEXT.row(
      String(index + 1).padStart(RUN_INDEX_WIDTH), entry.name.padEnd(RUN_NAME_COLUMN_WIDTH), ownerOf(entry).padEnd(RUN_OWNER_COLUMN_WIDTH),
      size.padStart(RUN_SIZE_COLUMN_WIDTH), agoText(now - entry.updated),
    ), colorOfRun(entry));
  });
}

function runs(args: readonly string[]): void {
  if (args.length) throw new Error(usageError(TEXT.usage));
  listRuns().then(printRuns).catch(() => print(TEXT.listFailed, COLOR.error));
}

export const runsCommand = Object.freeze({
  parent: COMMAND.name,
  name: RUNS_COMMAND.name,
  aliases: RUNS_COMMAND.aliases,
  remote: false,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, examples: TEXT.examples, see: TEXT.see },
  run: runs,
});
