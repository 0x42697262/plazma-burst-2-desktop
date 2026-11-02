import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';

export const saveMapsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.mapCache.saveMaps, settings: SETTINGS });
