import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { fingerprintCommand } from './command.ts';

export const fingerprintParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.serverList.fingerprint, commands: [fingerprintCommand] });
