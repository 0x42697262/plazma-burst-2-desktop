import type { CapabilityParts } from '#console/feature-types.ts';
import { mineParts } from './capabilities/mine/parts.ts';
import { relationsParts } from './capabilities/relations/parts.ts';
import { playersParts } from './capabilities/players/parts.ts';
import { deviceParts } from './capabilities/device/parts.ts';

export const REPUTATION_PARTS: readonly CapabilityParts[] = Object.freeze([
  mineParts,
  relationsParts,
  playersParts,
  deviceParts,
]);
