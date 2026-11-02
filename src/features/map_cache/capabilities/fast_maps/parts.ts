import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';

export const fastMapsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.mapCache.fastMaps, settings: SETTINGS });
