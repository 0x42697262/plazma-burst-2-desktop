import { stringOf } from '#kernel/text/text-of.ts';
import { game } from '../game/bindings.ts';
import { specOf } from '../state/schema.ts';
import { RANKED_HOLD } from '../state/keys.ts';
import { checksBypassed } from '../danger/bypass.ts';
import { NORMAL_ZOOM_PCT } from './constants.ts';
import { GAME_COMMANDS_HELD } from './keys.ts';
import { BYPASS_HINT, REASON, TEXT } from './text.ts';

export { BYPASS_HINT, NORMAL_ZOOM_PCT, REASON };

export function rankedMatch(): boolean {
  if (game.isMP() !== true) return false;
  const details = game.matchDetails();
  return !!details && Number(details.approved) > 0 && details.ranked === true;
}

export const guarding = (): boolean => !checksBypassed() && rankedMatch();

export function heldBack(key: string, value: unknown, gameMax?: number | null): string | null {
  if (!guarding()) return null;
  const hold = specOf(key)?.rankedHold;
  const isPositive = typeof value === 'number' && value > 0;
  if (hold === RANKED_HOLD.positive && isPositive) return REASON.hp;
  const isAboveGameMax = gameMax === null || gameMax === undefined || (typeof value === 'number' && value > gameMax);
  if (hold === RANKED_HOLD.aboveGameMax && isAboveGameMax) return REASON.hp;
  return null;
}

export const zoomHeldBack = (percent: number): string | null => (guarding() && percent < NORMAL_ZOOM_PCT ? REASON.aim : null);

export function gameCommandHeldBack(text: unknown): string | null {
  if (!guarding()) return null;
  const hit = GAME_COMMANDS_HELD.find(([pattern]) => pattern.test(stringOf(text).trim()));
  return hit ? REASON[hit[1]] : null;
}

export const refusal = (what: string, reason: string): Error => new Error(TEXT.refused(what, reason));
