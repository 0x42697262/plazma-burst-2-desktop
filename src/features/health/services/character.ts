import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import type { Character } from '#console/kernel/game/types.ts';
import { guarding } from '#console/kernel/overrides/server-checks.ts';

export const maxHpOf = (character: Character): number => character[GAME_FIELDS.MAX_HP];
export const healthOf = (character: Character): number => character[GAME_FIELDS.HP];
export const isOverRankedLimit = (character: Character): boolean => guarding() && healthOf(character) > maxHpOf(character);
export const clampToMax = (character: Character): void => { character[GAME_FIELDS.HP] = maxHpOf(character); };
