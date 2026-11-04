import type { CapabilityParts } from '#console/feature-types.ts';
import { posParts } from './capabilities/pos/parts.ts';
import { charsParts } from './capabilities/chars/parts.ts';
import { uidParts } from './capabilities/uid/parts.ts';

export const PLAYER_INFO_PARTS: readonly CapabilityParts[] = Object.freeze([
  posParts,
  charsParts,
  uidParts,
]);
