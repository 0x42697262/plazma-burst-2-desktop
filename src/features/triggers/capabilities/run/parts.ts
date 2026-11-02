import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { runCommand } from './command.ts';

export const runParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.run, commands: [runCommand] });
