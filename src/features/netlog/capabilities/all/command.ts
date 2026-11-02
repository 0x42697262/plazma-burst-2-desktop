import { print } from '#console/kernel/ui/log.ts';
import { runKey } from '#console/kernel/commands/settings.ts';
import { COMMAND, SETTING } from '../../keys.ts';
import { usageError } from '../../text.ts';
import { isSet } from '../../services/page-recorder.ts';
import { ALL_COMMAND } from './keys.ts';
import { ALL_TEXT as TEXT } from './text.ts';

function everything(args: readonly string[]): void {
  if (args.length > 1) throw new Error(usageError(TEXT.usage));
  if (!args.length) {
    print(TEXT.value(isSet(SETTING.netLogAll)));
    return;
  }
  runKey(SETTING.netLogAll, args);
}

export const allCommand = Object.freeze({
  parent: COMMAND.name,
  name: ALL_COMMAND.name,
  aliases: ALL_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, examples: TEXT.examples, see: TEXT.see },
  run: everything,
});
