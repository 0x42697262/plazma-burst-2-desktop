import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { regionsCommand } from './command.ts';

export const regionsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.regions, commands: [regionsCommand] });
