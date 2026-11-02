import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { gunOverride } from './override.ts';

export const gunParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.guns.gun, settings: SETTINGS, overrides: [gunOverride] });
