import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { swordsOverride } from './override.ts';

export const swordsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.swords, settings: SETTINGS, overrides: [swordsOverride] });
