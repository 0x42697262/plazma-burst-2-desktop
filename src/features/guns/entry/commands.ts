import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { MAX_UPGRADE, MODEL_WIDTH, NUMBER_WIDTH, SLOT_WIDTH } from '../constants.ts';
import { ALL_WORD, COMMAND, GUN_KINDS, INDEX_PREFIX, MATCH_SEPARATOR, NUMBER_WORD, TARGET_WORD, WORD_SEPARATOR, YOU } from '../keys.ts';
import { TEXT } from '../text.ts';
import { filterGuns, resolveGun, slotText } from '../domain/catalog.ts';
import { dropGun, giveGun, gunList } from '../services/armory.ts';
import { characters, gunBindings, slots } from '../adapters/game-guns.ts';

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

export const gunsCommand = Object.freeze({
  name: COMMAND.guns,
  aliases: COMMAND.gunsAliases,
  usage: TEXT.guns.usage,
  desc: TEXT.guns.desc,
  help: { about: TEXT.guns.about, args: TEXT.guns.args, examples: TEXT.guns.examples, see: TEXT.guns.see },
  run: (_args: Args, { rest }: { rest: string }) => listGuns(rest),
});

export const gunCommands = Object.freeze([
  {
    name: COMMAND.give,
    usage: TEXT.give.usage,
    desc: TEXT.give.desc,
    clientOnly: TEXT.give.clientOnly,
    complete: (index: number) => (index === 0 ? gunList().map((gun) => gun.model) : null),
    help: { about: TEXT.give.about, args: TEXT.give.args, examples: TEXT.give.examples, notes: TEXT.give.notes, see: TEXT.give.see },
    run: give,
  },
  {
    name: COMMAND.drop,
    aliases: COMMAND.dropAliases,
    usage: TEXT.drop.usage,
    desc: TEXT.drop.desc(slots.first, slots.last),
    clientOnly: TEXT.drop.clientOnly,
    help: { about: TEXT.drop.about, args: TEXT.drop.args(slots.first, slots.last), examples: TEXT.drop.examples, see: TEXT.drop.see },
    run: drop,
  },
]);
