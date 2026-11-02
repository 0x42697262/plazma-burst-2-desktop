import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { protection } from '../../adapters/game-scan.ts';
import { CHECKS_COMMAND, UNLOCK_PHRASE } from './keys.ts';
import { CHECKS_TEXT as TEXT } from './text.ts';
import { askToBypass, checksBypassed, protectAgain } from './state.ts';

type Args = readonly string[];
type Context = { source?: string; chained?: boolean };

function askToTurnOff(args: Args, context: Context): void {
  if (args.length) throw new Error(TEXT.checksUsage);
  if (context.source || context.chained) throw new Error(TEXT.typeItYourself);
  if (checksBypassed()) {
    print(TEXT.alreadyOff, COLOR.notice);
    return;
  }
  for (const line of TEXT.warning(UNLOCK_PHRASE, protection.reasons.hp, protection.reasons.aim)) print(line, COLOR.error);
  askToBypass();
}

function turnOn(args: Args): void {
  if (args.length) throw new Error(TEXT.offUsage);
  const wasBypassed = checksBypassed();
  protectAgain();
  print(wasBypassed ? TEXT.onAgain : TEXT.alreadyOn, wasBypassed ? COLOR.ok : COLOR.notice);
}

export const checksCommands = Object.freeze([
  { parent: COMMAND.name, name: CHECKS_COMMAND.checks, aliases: CHECKS_COMMAND.checksAliases, usage: TEXT.checks.usage, desc: TEXT.checks.desc, help: { about: TEXT.checks.about(UNLOCK_PHRASE), notes: TEXT.checks.notes, see: TEXT.checks.see }, run: askToTurnOff },
  { parent: COMMAND.name, name: CHECKS_COMMAND.off, aliases: CHECKS_COMMAND.offAliases, usage: TEXT.turnOn.usage, desc: TEXT.turnOn.desc, help: { about: TEXT.turnOn.about, see: TEXT.turnOn.see }, run: turnOn },
]);
