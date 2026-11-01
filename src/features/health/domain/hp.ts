import { BONUS_PRECISION, PERCENT } from '../constants.ts';
import { PERCENT_SIGN, PLUS } from '../keys.ts';

export type HpChange = { isPercent: boolean; amount: number };

export function parseHpChange(raw: string): HpChange {
  const isPercent = raw.endsWith(PERCENT_SIGN);
  return { isPercent, amount: Number(isPercent ? raw.slice(0, -PERCENT_SIGN.length) : raw) };
}

export const changedMaxHp = (max: number, { isPercent, amount }: HpChange): number => Math.max(1, Math.round(isPercent ? max * (1 + amount / PERCENT) : max + amount));

export const nextBonus = (current: number, amount: number): number => Math.round((current + amount) * BONUS_PRECISION) / BONUS_PRECISION;

export const signed = (value: number): string => `${value > 0 ? PLUS : ''}${value}`;
