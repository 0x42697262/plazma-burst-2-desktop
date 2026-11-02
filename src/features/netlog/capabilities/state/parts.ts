import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';

export const stateParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.netlog.state, settings: SETTINGS });
