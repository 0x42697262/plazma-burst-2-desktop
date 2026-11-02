import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { godOverride } from './override.ts';

export const godParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.health.god, settings: SETTINGS, overrides: [godOverride] });
