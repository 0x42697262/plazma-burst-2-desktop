import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';

export const allParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.netlog.all, settings: SETTINGS });
