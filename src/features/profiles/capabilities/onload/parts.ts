import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { onloadCommand } from './command.ts';

export const onloadParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.profiles.onload, commands: [onloadCommand] });
