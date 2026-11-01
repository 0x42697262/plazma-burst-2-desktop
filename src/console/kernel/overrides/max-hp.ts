import { GAME_FIELDS } from '../game/fields.ts';
import { player, isActive } from '../game/level.ts';
import type { Character } from '../game/types.ts';
import { original } from './force.ts';

const hpBonusApplied = new WeakMap<object, number>();

export const hpBonusAppliedTo = (character: object): number => hpBonusApplied.get(character) ?? 0;
export const setHpBonusApplied = (character: object, amount: number): void => { hpBonusApplied.set(character, amount); };

export const gameMaxOf = (character: Character | null): number | null => (character ? (original(character, GAME_FIELDS.MAX_HP) as number) - hpBonusAppliedTo(character) : null);
export const gameMaxHp = (): number | null => (isActive() ? gameMaxOf(player()) : null);
