import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { worldGravityOverride } from './override.ts';

export const worldGravityParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.worldGravity, settings: SETTINGS, overrides: [worldGravityOverride] });
