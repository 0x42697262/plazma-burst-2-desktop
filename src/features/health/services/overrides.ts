import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import type { Character } from '#console/kernel/game/types.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { force, restore } from '#console/kernel/overrides/force.ts';
import { heldBack, guarding } from '#console/kernel/overrides/server-checks.ts';
import { gameMaxOf, hpBonusAppliedTo, setHpBonusApplied } from '#console/kernel/overrides/max-hp.ts';
import { TEXT as OVERRIDE_TEXT } from '#console/kernel/overrides/text.ts';
import { MIN_MAX_HP, PERCENT } from '../constants.ts';
import { NOTE_SEPARATOR, OVERRIDE_NAME } from '../keys.ts';
import { installGod, uninstallGodExcept, uninstallAllGod } from '../adapters/god.ts';

const lastMaxHp = new WeakMap<object, unknown>();
let heldNote = '';

const valueOf = (key: string): unknown => settings.get(key);
const numberOf = (key: string): number => valueOf(key) as number;
const maxHpOf = (character: Character): number => character[GAME_FIELDS.MAX_HP];
const healthOf = (character: Character): number => character[GAME_FIELDS.HP];

export function hpBonusFor(base: number): number {
  const flat = (settings.effective(KEY.HP_BONUS) as number | undefined) ?? 0;
  const percent = (settings.effective(KEY.HP_BONUS_PCT) as number | undefined) ?? 0;
  const flatBonus = heldBack(KEY.HP_BONUS, flat) ? 0 : flat;
  const percentBonus = heldBack(KEY.HP_BONUS_PCT, percent) ? 0 : Math.round(base * percent / PERCENT);
  return flatBonus + percentBonus;
}

const maxHpOn = (character: Character): boolean => settings.has(KEY.MAX_HP) && !heldBack(KEY.MAX_HP, valueOf(KEY.MAX_HP), gameMaxOf(character));

function noteHeld(character: Character): void {
  if (!guarding()) {
    heldNote = '';
    return;
  }
  const held = [KEY.MAX_HP, KEY.HP_BONUS, KEY.HP_BONUS_PCT].filter((key) => settings.has(key) && heldBack(key, valueOf(key), gameMaxOf(character)));
  const note = held.join(NOTE_SEPARATOR);
  if (note && note !== heldNote) print(OVERRIDE_TEXT.notApplying(note), COLOR.warn);
  heldNote = note;
}

function applyGod(character: Character): void {
  const isGod = !!valueOf(KEY.GOD);
  uninstallGodExcept(isGod ? character : null);
  if (!isGod) return;
  installGod(character, () => !!valueOf(KEY.GOD));
  if (character[GAME_FIELDS.DEAD] && healthOf(character) > 0) character[GAME_FIELDS.DEAD] = false;
}

function applyMaxHp(character: Character): void {
  if (maxHpOn(character)) {
    force(character, GAME_FIELDS.MAX_HP, valueOf(KEY.MAX_HP));
    if (lastMaxHp.get(character) !== valueOf(KEY.MAX_HP)) {
      character[GAME_FIELDS.HP] = numberOf(KEY.MAX_HP);
      lastMaxHp.set(character, valueOf(KEY.MAX_HP));
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

function keepToRankedLimit(character: Character): void {
  const isOverRankedLimit = guarding() && healthOf(character) > maxHpOf(character);
  if (!isOverRankedLimit) return;
  uninstallGodExcept(null);
  character[GAME_FIELDS.HP] = maxHpOf(character);
}

function applyGodOverride({ character }: OverrideContext): void {
  applyGod(character);
  keepToRankedLimit(character);
}

function applyHpOverride({ character }: OverrideContext): void {
  noteHeld(character);
  applyMaxHp(character);
  applyHpBonus(character);
  keepToRankedLimit(character);
}

const nothingToUndo = (): void => undefined;

export const godOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.god, capability: CAPABILITY.health.god, apply: applyGodOverride, cleanup: uninstallAllGod });
export const hpOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.hp, capability: CAPABILITY.health.hp, apply: applyHpOverride, cleanup: nothingToUndo });
