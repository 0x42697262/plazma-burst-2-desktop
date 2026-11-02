import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { MAX_UPGRADE } from '../../constants.ts';
import { COMMAND, NUMBER_WORD, TARGET_WORD, WORD_SEPARATOR } from '../../keys.ts';
import { TEXT } from './text.ts';
import { resolveGun } from '../../domain/catalog.ts';
import { giveGun } from './give.ts';
import { gunList } from '../../services/armory.ts';
import { characters } from '../../adapters/game-guns.ts';

type Args = readonly string[];

function give(rawArgs: Args): void {
  if (!rawArgs.length) throw new Error(TEXT.giveUsage);
  const { args, target } = characters.takeSuffix(rawArgs, TARGET_WORD.give, TEXT.giveUsage);
  let upgrade = MAX_UPGRADE;
  const last = args[args.length - 1];
  if (args.length > 1 && last !== undefined && NUMBER_WORD.test(last)) {
    args.pop();
    upgrade = Number(last);
    if (upgrade > MAX_UPGRADE) throw new Error(TEXT.upgradeRange);
  }
  if (!args.length) throw new Error(TEXT.giveUsage);
  const query = args.join(WORD_SEPARATOR);
  const result = giveGun(resolveGun(gunList(), query, characters.index(query)), upgrade, characters.target(target));
  print(result.text, result.isPartial ? COLOR.notice : COLOR.ok);
}

export const giveCommand = Object.freeze({
    name: COMMAND.give,
    usage: TEXT.give.usage,
    desc: TEXT.give.desc,
    clientOnly: TEXT.give.clientOnly,
    complete: (index: number) => (index === 0 ? gunList().map((gun) => gun.model) : null),
    help: { about: TEXT.give.about, args: TEXT.give.args, examples: TEXT.give.examples, notes: TEXT.give.notes, see: TEXT.give.see },
    run: give,
  });
