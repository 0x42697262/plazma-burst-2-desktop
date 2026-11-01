import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { flyOverride } from './override.ts';

export const flyParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.fly, overrides: [flyOverride] });
