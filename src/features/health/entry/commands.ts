import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import {
  hpBonus, keySetting, level, playerFields as fields, playerGame as game, playerSettings as settings, settingKeys as keys, words,
} from '#console/kernel/game/player-access.ts';
import { ALL_WORD, COMMAND, HP_CHANGE, HP_PERCENT_NO_SIGN, YOU } from '../keys.ts';
import { CLIENT_ONLY, TEXT } from '../text.ts';
import { changedMaxHp, nextBonus, parseHpChange, signed } from '../domain/hp.ts';
import { cancelLevelFailed, reviveCharacter } from '../services/revive.ts';
import { hpBonusFor } from '../services/overrides.ts';

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
  hint(TEXT.maxHpPreview(Math.round(max), Math.round(Math.max(1, base + hpBonusFor(base))), Math.round(base), bonus));
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

export const healthCommands = Object.freeze([
  { name: COMMAND.heal, usage: TEXT.heal.usage, desc: TEXT.heal.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.heal.about, see: TEXT.heal.see }, run: heal },
  { name: COMMAND.hp, usage: TEXT.hp.usage, desc: TEXT.hp.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.hp.about, examples: TEXT.hp.examples, notes: TEXT.hp.notes, see: TEXT.hp.see }, run: hp },
  { name: COMMAND.revive, aliases: COMMAND.reviveAliases, usage: TEXT.revive.usage, desc: TEXT.revive.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.revive.about, args: TEXT.revive.args, examples: TEXT.revive.examples, see: TEXT.revive.see }, run: revive },
]);
