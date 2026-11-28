import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { entryCommand } from './command.ts';

export const entryParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.reputation.entry, commands: [entryCommand] });
