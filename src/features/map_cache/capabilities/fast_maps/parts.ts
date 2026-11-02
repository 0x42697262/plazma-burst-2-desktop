import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';

export const fastMapsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.mapCache.fastMaps });
