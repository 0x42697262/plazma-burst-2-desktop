import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { jumpOverride } from './override.ts';

export const jumpParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.jump, overrides: [jumpOverride] });
