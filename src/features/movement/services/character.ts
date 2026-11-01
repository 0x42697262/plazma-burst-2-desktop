import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import type { MovingCharacter } from '#console/kernel/game/types.ts';

export const isAlive = (character: MovingCharacter): boolean => character[GAME_FIELDS.HP] > 0;
