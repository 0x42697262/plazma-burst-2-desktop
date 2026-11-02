import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { MODEL_WIDTH, NUMBER_WIDTH, SLOT_WIDTH } from '../../constants.ts';
import { COMMAND, GUN_KINDS, INDEX_PREFIX } from '../../keys.ts';
import { TEXT } from './text.ts';
import { filterGuns, slotText } from '../../domain/catalog.ts';
import { gunList } from '../../services/armory.ts';

type Args = readonly string[];

function listGuns(filter: string): void {
  const found = filterGuns(gunList(), filter);
  for (const kind of GUN_KINDS) {
    const rows = found.filter(({ gun }) => gun.kind === kind);
    if (!rows.length) continue;
    print(TEXT.kindTitle(kind, rows.length), COLOR.title);
    for (const { gun, number } of rows) print(TEXT.row((INDEX_PREFIX + String(number)).padEnd(NUMBER_WIDTH), gun.model.padEnd(MODEL_WIDTH), slotText(gun.slot).padEnd(SLOT_WIDTH), gun.name));
  }
  if (!found.length) print(TEXT.noneMatch(filter), COLOR.error);
  else print(TEXT.giveHint, COLOR.hint);
}

export const gunsCommand = Object.freeze({
  name: COMMAND.guns,
  aliases: COMMAND.gunsAliases,
  usage: TEXT.guns.usage,
  desc: TEXT.guns.desc,
  help: { about: TEXT.guns.about, args: TEXT.guns.args, examples: TEXT.guns.examples, see: TEXT.guns.see },
  run: (_args: Args, { rest }: { rest: string }) => listGuns(rest),
});
