import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '#console/kernel/core/keys.ts';
import { bindKey, unbindKey } from '#features/binds/index.ts';
import { COORDINATE_ARGUMENTS, DISTANCE_WIDTH, HP_WIDTH, INDEX_WIDTH, NICKNAME_WIDTH, TEAM_WIDTH } from '../constants.ts';
import { ALL_WORD, CHARS_HINT, COMMAND, HP_CHANGE, HP_PERCENT_NO_SIGN, NO_CHARACTER_NAMED, TO_WORD, TP_COMMAND, TP_OPTION, WORD_SEPARATOR, YOU } from '../keys.ts';
import { CLIENT_ONLY, TEXT } from '../text.ts';
import { changedMaxHp, nextBonus, parseHpChange, signed } from '../domain/hp.ts';
import { cancelLevelFailed, reviveCharacter } from '../services/revive.ts';
import {
  boundToTp, hpBonus, keySetting, level, playerFields as fields, playerGame as game, playerSettings as settings,
  settingKeys as keys, words, type Character,
} from '../adapters/game-player.ts';

type Args = readonly string[];
const hint = (text: string): void => print(text, COLOR.hint);
const numberSetting = (key: string): number => (settings.effective(key) as number | undefined) ?? 0;

function changeHp(raw: string): void {
  const change = parseHpChange(raw);
  if (settings.has(keys.MAX_HP)) {
    keySetting.set(keys.MAX_HP, changedMaxHp(settings.get(keys.MAX_HP) as number, change));
    return;
  }
  const key = change.isPercent ? keys.HP_BONUS_PCT : keys.HP_BONUS;
  const next = nextBonus(numberSetting(key), change.amount);
  if (next === 0) keySetting.unset(key, TEXT.removedNote);
  else keySetting.set(key, next);
  if (!level.isActive()) return;
  const character = level.player();
  const max = character[fields.MAX_HP] as number;
  const base = max - hpBonus.appliedTo(character);
  const flat = numberSetting(keys.HP_BONUS);
  const percent = numberSetting(keys.HP_BONUS_PCT);
  const bonus = [flat ? signed(flat) : '', percent ? TEXT.percentBonus(signed(percent)) : ''].filter(Boolean).join(TEXT.bonusSeparator) || TEXT.bonusNone;
  hint(TEXT.maxHpPreview(Math.round(max), Math.round(Math.max(1, base + hpBonus.forBase(base))), Math.round(base), bonus));
}

function reviveAll(): void {
  let count = 0;
  for (let index = 0; index < game.charCount(); index++) {
    const character = game.chars()[index];
    if (!character?.io || !level.isDown(character)) continue;
    try {
      if (reviveCharacter(index, hint)) count++;
    } catch (error) {
      print(TEXT.reviveFailed(index, (error as Error).message), COLOR.error);
    }
  }
  print(count ? TEXT.revivedCount(count) : TEXT.nobodyDown, count ? COLOR.ok : COLOR.notice);
  cancelLevelFailed(hint);
}

function revive(rawArgs: Args): void {
  level.require();
  const { options, rest } = words.options(rawArgs, [ALL_WORD]);
  if (rest.length > 1 || (options.size && rest.length)) throw new Error(TEXT.reviveUsage);
  const word = (rest[0] ?? '').toLowerCase();
  if (options.has(ALL_WORD) || word === ALL_WORD) {
    reviveAll();
    return;
  }
  const me = game.me();
  const index = word ? words.index(word) : me;
  if (index === null) throw new Error(TEXT.reviveUsage);
  const who = index === me ? YOU : level.label(index);
  if (!reviveCharacter(index, hint)) {
    print(TEXT.notDown(words.capitalize(level.be(who))), COLOR.notice);
    return;
  }
  print(TEXT.revived(who, Math.round(game.chars()[index]?.[fields.HP] as number)), COLOR.ok);
  cancelLevelFailed(hint);
}

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
  if (options.has(TP_OPTION.on)) {
    const [key] = args;
    if (options.has(TP_OPTION.off) || args.length !== 1 || key === undefined) throw new Error(TEXT.tpOnUsage);
    bindKey([key, TP_COMMAND]);
    return true;
  }
  if (!options.has(TP_OPTION.off)) return false;
  if (args.length) throw new Error(TEXT.tpOffUsage);
  const bound = boundToTp(TP_COMMAND);
  if (!bound.length) print(TEXT.noTpKey, COLOR.notice);
  for (const key of bound) unbindKey([key]);
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

function chars(): void {
  level.require();
  const list = game.chars();
  const me = game.me();
  const mine = level.player();
  for (let index = 0; index < game.charCount(); index++) {
    const character = list[index];
    if (!character?.io) continue;
    const hp = character[fields.HP] as number;
    const distance = Math.round(Math.hypot(character.x - mine.x, character.y - mine.y));
    const tag = index === me ? TEXT.youTag : character.team === mine.team ? TEXT.allyTag : TEXT.enemyTag;
    print(TEXT.charRow(
      String(index).padEnd(INDEX_WIDTH), (typeof character.nickname === 'string' && character.nickname ? character.nickname : TEXT.noNickname).padEnd(NICKNAME_WIDTH), String(character.team).padEnd(TEAM_WIDTH),
      TEXT.hpOf(Math.round(hp), Math.round(character[fields.MAX_HP] as number)).padEnd(HP_WIDTH), hp > 0 ? TEXT.alive : TEXT.deadState, String(distance).padStart(DISTANCE_WIDTH), tag,
    ), index === me ? COLOR.ok : undefined);
  }
}

function pos(): void {
  level.require();
  const character = level.player();
  const point = character[fields.REF_PT] as number;
  print(TEXT.position(Math.round(game.ptX()[point] ?? 0), Math.round(game.ptY()[point] ?? 0), Math.round(character.tarx), Math.round(character.tary)));
}

function heal(): void {
  const character = level.player();
  level.require();
  if (level.isDown(character)) throw new Error(TEXT.down);
  character[fields.HP] = character[fields.MAX_HP];
  print(TEXT.healed(character[fields.MAX_HP]), COLOR.ok);
}

function hp(args: Args): void {
  const [raw] = args;
  if (args.length === 1 && raw !== undefined && HP_CHANGE.test(raw)) {
    changeHp(raw);
    return;
  }
  if (args.length === 1 && raw !== undefined && HP_PERCENT_NO_SIGN.test(raw)) throw new Error(TEXT.needsSign(raw));
  keySetting.run(keys.MAX_HP, args);
}

export const playerCommands = Object.freeze([
  { name: COMMAND.heal, usage: TEXT.heal.usage, desc: TEXT.heal.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.heal.about, see: TEXT.heal.see }, run: heal },
  { name: COMMAND.hp, usage: TEXT.hp.usage, desc: TEXT.hp.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.hp.about, examples: TEXT.hp.examples, notes: TEXT.hp.notes, see: TEXT.hp.see }, run: hp },
  { name: COMMAND.revive, aliases: COMMAND.reviveAliases, usage: TEXT.revive.usage, desc: TEXT.revive.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.revive.about, args: TEXT.revive.args, examples: TEXT.revive.examples, see: TEXT.revive.see }, run: revive },
  { name: COMMAND.tp, aliases: COMMAND.tpAliases, usage: TEXT.tp.usage, desc: TEXT.tp.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.tp.about, args: TEXT.tp.args, examples: TEXT.tp.examples, notes: TEXT.tp.notes, see: TEXT.tp.see }, run: tp },
  { name: COMMAND.pos, aliases: COMMAND.posAliases, usage: TEXT.pos.usage, desc: TEXT.pos.desc, help: { about: TEXT.pos.about, see: TEXT.pos.see }, run: pos },
  { name: COMMAND.chars, aliases: COMMAND.charsAliases, usage: TEXT.chars.usage, desc: TEXT.chars.desc, help: { about: TEXT.chars.about, see: TEXT.chars.see }, run: chars },
]);
