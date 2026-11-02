import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { protectionHint } from '#console/kernel/ports/protection.ts';
import { COMMAND } from '../../keys.ts';
import { protection } from '../../adapters/game-scan.ts';
import { STATUS_TEXT as TEXT } from './text.ts';

function status(args: readonly string[]): void {
  if (args.length) throw new Error(TEXT.statusUsage);
  if (protection.isOff()) {
    print(TEXT.off, COLOR.error);
    return;
  }
  print(TEXT.on(protection.isRankedMatch()), COLOR.ok);
  print(TEXT.onUntouched, COLOR.hint);
  print(TEXT.onWhat, COLOR.hint);
  print(TEXT.onSee, COLOR.hint);
  const hint = protectionHint();
  if (hint) print(hint, COLOR.hint);
}

export const statusCommand = Object.freeze({
  parent: COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples, see: TEXT.see },
  run: status,
});
