import type { CapabilityParts } from '#console/feature-types.ts';
import { mapsParts } from './capabilities/maps/parts.ts';
import { saveMapsParts } from './capabilities/save_maps/parts.ts';
import { fastMapsParts } from './capabilities/fast_maps/parts.ts';

export const MAP_CACHE_PARTS: readonly CapabilityParts[] = Object.freeze([
  mapsParts,
  saveMapsParts,
  fastMapsParts,
]);
