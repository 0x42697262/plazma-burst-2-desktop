import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { keyBinder } from '#console/kernel/ports/key-binder.ts';
import { boundToTp, level, playerFields as fields, playerGame as game, words, type Character } from '#console/kernel/game/player-access.ts';
import { COORDINATE_ARGUMENTS } from '../constants.ts';
import { CHARS_HINT, COMMAND, NO_CHARACTER_NAMED, TO_WORD, TP_COMMAND, TP_OPTION, WORD_SEPARATOR } from '../keys.ts';
import { CLIENT_ONLY, TEXT } from '../text.ts';

type Args = readonly string[];

function teleportTo(targetX: number, targetY: number, label?: string): void {
  level.require();
  if (!((level.player()[fields.HP] as number) > 0)) throw new Error(TEXT.dead);
  level.moveTo(targetX, targetY);
  print(TEXT.teleported(label, Math.round(targetX), Math.round(targetY)), COLOR.ok);
}

function teleportToCrosshair(): void {
  level.require();
  const character = level.player();
  if (!Number.isFinite(character.tarx) || !Number.isFinite(character.tary)) throw new Error(TEXT.crosshairUnknown);
  teleportTo(character.tarx, character.tary);
}

function teleportToCharacter(query: string): void {
  level.require();
  const index = level.resolve(query);
  if (index === game.me()) throw new Error(TEXT.thatIsYou);
  const target = game.chars()[index] as Character;
  const point = target[fields.REF_PT] as number;
  const targetX = game.ptX()[point];
  const targetY = game.ptY()[point];
  if (targetX === undefined || targetY === undefined || !Number.isFinite(targetX) || !Number.isFinite(targetY)) throw new Error(TEXT.positionUnknown(index));
  teleportTo(targetX, targetY, level.label(index, target));
}

function tpKeys(options: Set<string>, args: Args): boolean {
  const isKeyOption = options.has(TP_OPTION.on) || options.has(TP_OPTION.off);
  if (!isKeyOption) return false;
  const binder = keyBinder();
  if (!binder) throw new Error(TEXT.needsBinds);
  if (options.has(TP_OPTION.on)) {
    const [key] = args;
    if (options.has(TP_OPTION.off) || args.length !== 1 || key === undefined) throw new Error(TEXT.tpOnUsage);
    binder.bind([key, TP_COMMAND]);
    return true;
  }
  if (args.length) throw new Error(TEXT.tpOffUsage);
  const bound = boundToTp(TP_COMMAND);
  if (!bound.length) print(TEXT.noTpKey, COLOR.notice);
  for (const key of bound) binder.unbind([key]);
  return true;
}

function tp(rawArgs: Args): void {
  const { options, rest: args, literal } = words.options(rawArgs, Object.values(TP_OPTION));
  if (tpKeys(options, args)) return;
  if (!args.length) {
    teleportToCrosshair();
    return;
  }
  const [first = '', second = ''] = args;
  const isCoordinates = !literal && args.length === COORDINATE_ARGUMENTS && words.isNumber(first) && words.isNumber(second);
  if (isCoordinates) {
    teleportTo(Number(first), Number(second));
    return;
  }
  const who = !literal && args.length > 1 && first.toLowerCase() === TO_WORD ? args.slice(1) : args;
  try {
    teleportToCharacter(who.join(WORD_SEPARATOR));
  } catch (error) {
    const message = (error as Error).message;
    const oldOption = Object.values(TP_OPTION).find((option) => option === who[0]?.toLowerCase());
    const isOldSyntax = oldOption && !literal && NO_CHARACTER_NAMED.test(message);
    if (isOldSyntax) throw new Error(TEXT.oldHotkey(message.replace(CHARS_HINT, ''), oldOption, who.slice(1).join(WORD_SEPARATOR)), { cause: error });
    throw error;
  }
}

export const teleportCommand = Object.freeze({
  name: COMMAND.tp, aliases: COMMAND.tpAliases, usage: TEXT.tp.usage, desc: TEXT.tp.desc, clientOnly: CLIENT_ONLY,
  help: { about: TEXT.tp.about, args: TEXT.tp.args, examples: TEXT.tp.examples, notes: TEXT.tp.notes, see: TEXT.tp.see }, run: tp,
});
