import type { CapabilityParts } from '#console/feature-types.ts';
import { hpParts } from './capabilities/hp/parts.ts';
import { godParts } from './capabilities/god/parts.ts';
import { healParts } from './capabilities/heal/parts.ts';
import { reviveParts } from './capabilities/revive/parts.ts';

export const HEALTH_PARTS: readonly CapabilityParts[] = Object.freeze([
  hpParts,
  godParts,
  healParts,
  reviveParts,
]);
