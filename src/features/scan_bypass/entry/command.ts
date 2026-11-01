import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { COMMAND } from '../keys.ts';
import { TEXT } from '../text.ts';
import { protection } from '../adapters/game-scan.ts';

type Args = readonly string[];
type Context = { source?: string; chained?: boolean };

function status(args: Args): void {
  if (args.length) throw new Error(TEXT.statusUsage);
  if (protection.isBypassed()) {
    print(TEXT.off, COLOR.error);
    print(TEXT.offHint, COLOR.hint);
    return;
  }
  print(TEXT.on(protection.isRankedMatch()), COLOR.ok);
  print(TEXT.onUntouched, COLOR.hint);
  print(TEXT.onWhat, COLOR.hint);
  print(TEXT.onSee, COLOR.hint);
}

function askToTurnOff(args: Args, context: Context): void {
  if (args.length) throw new Error(TEXT.checksUsage);
  if (context.source || context.chained) throw new Error(TEXT.typeItYourself);
  if (protection.isBypassed()) {
    print(TEXT.alreadyOff, COLOR.notice);
    return;
  }
  for (const line of TEXT.warning(protection.unlockPhrase, protection.reasons.hp, protection.reasons.aim)) print(line, COLOR.error);
  protection.ask();
}

function turnOn(args: Args): void {
  if (args.length) throw new Error(TEXT.offUsage);
  const wasBypassed = protection.isBypassed();
  protection.protectAgain();
  print(wasBypassed ? TEXT.onAgain : TEXT.alreadyOn, wasBypassed ? COLOR.ok : COLOR.notice);
}

export const bypassCommand = Object.freeze({
  remote: false,
  name: COMMAND.name,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about(protection.unlockPhrase), examples: TEXT.examples, notes: TEXT.notes, see: TEXT.see },
  run: status,
  subcommands: [
    { name: COMMAND.checks, aliases: COMMAND.checksAliases, usage: TEXT.checks.usage, desc: TEXT.checks.desc, help: { about: TEXT.checks.about(protection.unlockPhrase), notes: TEXT.checks.notes, see: TEXT.checks.see }, run: askToTurnOff },
    { name: COMMAND.off, aliases: COMMAND.offAliases, usage: TEXT.turnOn.usage, desc: TEXT.turnOn.desc, help: { about: TEXT.turnOn.about, see: TEXT.turnOn.see }, run: turnOn },
  ],
});
