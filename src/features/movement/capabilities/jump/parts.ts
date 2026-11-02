import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { jumpOverride } from './override.ts';

export const jumpParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.jump, settings: SETTINGS, overrides: [jumpOverride] });
