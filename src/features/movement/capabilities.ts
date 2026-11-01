import type { CapabilityParts } from '#console/feature-types.ts';
import { speedParts } from './capabilities/speed/parts.ts';
import { jumpParts } from './capabilities/jump/parts.ts';
import { gravityParts } from './capabilities/gravity/parts.ts';
import { flyParts } from './capabilities/fly/parts.ts';
import { swordsParts } from './capabilities/swords/parts.ts';
import { worldGravityParts } from './capabilities/world_gravity/parts.ts';

export const MOVEMENT_PARTS: readonly CapabilityParts[] = Object.freeze([
  speedParts,
  jumpParts,
  gravityParts,
  flyParts,
  swordsParts,
  worldGravityParts,
]);
