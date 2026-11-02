import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';

export const recordParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.netlog.record, settings: SETTINGS });
