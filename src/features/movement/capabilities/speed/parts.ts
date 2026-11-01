import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { speedOverride } from './override.ts';

export const speedParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.speed, overrides: [speedOverride] });
