import type { CapabilityParts } from '#console/feature-types.ts';
import { gameParts } from './capabilities/game/parts.ts';
import { builtinParts } from './capabilities/builtin/parts.ts';

export const GAME_CHAT_PARTS: readonly CapabilityParts[] = Object.freeze([
  gameParts,
  builtinParts,
]);
