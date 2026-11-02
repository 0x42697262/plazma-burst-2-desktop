import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import type { Character } from '#console/kernel/game/types.ts';
import { SETTING } from '#features/health/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { force, restore } from '#console/kernel/overrides/force.ts';
import { heldBack, guarding } from '#console/kernel/overrides/server-checks.ts';
import { gameMaxOf, hpBonusAppliedTo, setHpBonusApplied } from '#console/kernel/overrides/max-hp.ts';
import { TEXT as OVERRIDE_TEXT } from '#console/kernel/overrides/text.ts';
import { MIN_MAX_HP, PERCENT } from '../../constants.ts';
import { NOTE_SEPARATOR, OVERRIDE_NAME } from '../../keys.ts';
import { clampToMax, healthOf, isOverRankedLimit, maxHpOf } from '../../services/character.ts';

const lastMaxHp = new WeakMap<object, unknown>();
let heldNote = '';

const valueOf = (key: string): unknown => settings.get(key);
const numberOf = (key: string): number => valueOf(key) as number;

export function hpBonusFor(base: number): number {
  const flat = (settings.effective(SETTING.hpBonus) as number | undefined) ?? 0;
  const percent = (settings.effective(SETTING.hpBonusPct) as number | undefined) ?? 0;
  const flatBonus = heldBack(SETTING.hpBonus, flat) ? 0 : flat;
  const percentBonus = heldBack(SETTING.hpBonusPct, percent) ? 0 : Math.round(base * percent / PERCENT);
  return flatBonus + percentBonus;
}

const maxHpOn = (character: Character): boolean => settings.has(SETTING.maxHp) && !heldBack(SETTING.maxHp, valueOf(SETTING.maxHp), gameMaxOf(character));

function noteHeld(character: Character): void {
  if (!guarding()) {
    heldNote = '';
    return;
  }
  const held = [SETTING.maxHp, SETTING.hpBonus, SETTING.hpBonusPct].filter((key) => settings.has(key) && heldBack(key, valueOf(key), gameMaxOf(character)));
  const note = held.join(NOTE_SEPARATOR);
  if (note && note !== heldNote) print(OVERRIDE_TEXT.notApplying(note), COLOR.warn);
  heldNote = note;
}

function applyMaxHp(character: Character): void {
  if (maxHpOn(character)) {
    force(character, GAME_FIELDS.MAX_HP, valueOf(SETTING.maxHp));
    if (lastMaxHp.get(character) !== valueOf(SETTING.maxHp)) {
      character[GAME_FIELDS.HP] = numberOf(SETTING.maxHp);
      lastMaxHp.set(character, valueOf(SETTING.maxHp));
    }
  } else if (restore(character, GAME_FIELDS.MAX_HP)) {
    lastMaxHp.delete(character);
    if (healthOf(character) > maxHpOf(character)) character[GAME_FIELDS.HP] = maxHpOf(character);
  }
}

function applyHpBonus(character: Character): void {
  if (maxHpOn(character) || !(healthOf(character) > 0) || character[GAME_FIELDS.DEAD]) return;
  const applied = hpBonusAppliedTo(character);
  const wanted = hpBonusFor(maxHpOf(character) - applied);
  if (wanted === applied) return;
  const newMax = Math.max(MIN_MAX_HP, maxHpOf(character) + (wanted - applied));
  const reallyAdded = newMax - maxHpOf(character);
  if (reallyAdded === 0) return;
  character[GAME_FIELDS.MAX_HP] = newMax;
  character[GAME_FIELDS.HP] = Math.max(MIN_MAX_HP, Math.min(healthOf(character) + Math.max(reallyAdded, 0), maxHpOf(character)));
  setHpBonusApplied(character, applied + reallyAdded);
}

function apply({ character }: OverrideContext): void {
  noteHeld(character);
  applyMaxHp(character);
  applyHpBonus(character);
  if (isOverRankedLimit(character)) clampToMax(character);
}

const nothingToUndo = (): void => undefined;

export const hpOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.hp, capability: CAPABILITY.health.hp, apply, cleanup: nothingToUndo });
