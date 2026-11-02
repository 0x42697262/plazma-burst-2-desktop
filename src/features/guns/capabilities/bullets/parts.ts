import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { bulletsOverride } from './override.ts';

export const bulletsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.guns.bullets, overrides: [bulletsOverride] });
