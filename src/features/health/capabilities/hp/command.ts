import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { hpBonus, keySetting, level, playerFields as fields, playerSettings as settings, settingKeys as keys } from '#console/kernel/game/player-access.ts';
import { COMMAND, HP_CHANGE, HP_PERCENT_NO_SIGN } from '../../keys.ts';
import { CLIENT_ONLY, TEXT } from '../../text.ts';
import { changedMaxHp, nextBonus, parseHpChange, signed } from '../../domain/hp.ts';
import { hpBonusFor } from './override.ts';

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

function hp(args: Args): void {
  const [raw] = args;
  if (args.length === 1 && raw !== undefined && HP_CHANGE.test(raw)) {
    changeHp(raw);
    return;
  }
  if (args.length === 1 && raw !== undefined && HP_PERCENT_NO_SIGN.test(raw)) throw new Error(TEXT.needsSign(raw));
  keySetting.run(keys.MAX_HP, args);
}

export const hpCommand = Object.freeze({ name: COMMAND.hp, capability: CAPABILITY.health.hp, usage: TEXT.hp.usage, desc: TEXT.hp.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.hp.about, examples: TEXT.hp.examples, notes: TEXT.hp.notes, see: TEXT.hp.see }, run: hp });
