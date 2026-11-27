import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { SKILL_DECIMALS } from '../../constants.ts';
import { COMMAND, VIEW } from '../../keys.ts';
import { TEXT } from './text.ts';
import { askList } from '../../adapters/lobby.ts';

const shown = (value: unknown): string => (value === undefined || value === null ? TEXT.noValue : stringOf(value));
const skillText = (value: unknown): string => (typeof value === 'number' ? value.toFixed(SKILL_DECIMALS) : shown(value));

function mine(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(TEXT.usageError);
  print(TEXT.asking, COLOR.hint);
  return askList(VIEW.matches)
    .then(({ own }) => {
      if (!own) {
        print(TEXT.noNumbers, COLOR.notice);
        return;
      }
      print(TEXT.reputation(shown(own.reputation), shown(own.potential)), COLOR.title);
      print(TEXT.stats(skillText(own.skill), shown(own.wins), shown(own.losses)));
    })
    .catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

export const mineCommand = Object.freeze({
  parent: COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples, see: TEXT.see },
  run: mine,
});
