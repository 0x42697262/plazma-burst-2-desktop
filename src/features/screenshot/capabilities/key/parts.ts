import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';

export const keyParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.screenshot.key, settings: SETTINGS });
