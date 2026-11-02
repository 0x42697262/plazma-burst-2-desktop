import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';

export const saveMapsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.mapCache.saveMaps });
