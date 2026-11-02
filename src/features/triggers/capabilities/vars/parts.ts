import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { varsCommand } from './command.ts';

export const varsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.vars, commands: [varsCommand] });
