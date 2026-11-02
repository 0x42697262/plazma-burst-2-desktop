import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { gravityOverride } from './override.ts';

export const gravityParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.gravity, settings: SETTINGS, overrides: [gravityOverride] });
