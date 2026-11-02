import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { ALL_WORD, COMMAND, MATCH_SEPARATOR, TARGET_WORD, YOU } from '../../keys.ts';
import { TEXT } from './text.ts';
import { dropGun } from './drop.ts';
import { characters, gunBindings, slots } from '../../adapters/game-guns.ts';

type Args = readonly string[];

function slotsToDrop(word: string, character: { curwea: number; [field: string]: unknown }, who: string, usage: string): number[] {
  if (word === ALL_WORD) return [...slots.all];
  if (slots.all.map(String).includes(word)) return [Number(word)];
  if (word) throw new Error(usage);
  const held = slots.all.find((slot) => character.curwea >= 0 && character[slots.field(slot)] === character.curwea);
  if (held === undefined) throw new Error(TEXT.notHolding(characters.be(who)));
  return [held];
}

function drop(rawArgs: Args): void {
  const usage = TEXT.dropUsage(slots.first, slots.last);
  const { args, target } = characters.takeSuffix(rawArgs, TARGET_WORD.drop, usage);
  if (args.length > 1) throw new Error(usage);
  const { p: character, i: index, who } = characters.target(target);
  const word = (args[0] ?? '').toLowerCase();
  const chosen = slotsToDrop(word, character, who, usage);
  const dropped: string[] = [];
  for (const slot of chosen) {
    const gun = dropGun(character, slot);
    if (gun) dropped.push(TEXT.droppedGun(gunBindings.gunName(gun.model ?? '') || gun.model || TEXT.gunWord, slot));
  }
  if (!dropped.length) {
    print(word === ALL_WORD ? TEXT.noGuns(characters.capitalize(characters.have(who))) : TEXT.slotEmpty(chosen[0] ?? slots.first), COLOR.notice);
    return;
  }
  gunBindings.refreshChar(index);
  print(TEXT.dropped(who === YOU ? null : who, dropped.join(MATCH_SEPARATOR)), COLOR.ok);
}

export const dropCommand = Object.freeze({
    name: COMMAND.drop,
    aliases: COMMAND.dropAliases,
    usage: TEXT.drop.usage,
    desc: TEXT.drop.desc(slots.first, slots.last),
    clientOnly: TEXT.drop.clientOnly,
    help: { about: TEXT.drop.about, args: TEXT.drop.args(slots.first, slots.last), examples: TEXT.drop.examples, see: TEXT.drop.see },
    run: drop,
  });
