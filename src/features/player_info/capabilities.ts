import type { CapabilityParts } from '#console/feature-types.ts';
import { posParts } from './capabilities/pos/parts.ts';
import { charsParts } from './capabilities/chars/parts.ts';

export const PLAYER_INFO_PARTS: readonly CapabilityParts[] = Object.freeze([
  posParts,
  charsParts,
]);
