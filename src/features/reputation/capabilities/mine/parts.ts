import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { mineCommand } from './command.ts';

export const mineParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.reputation.mine, commands: [mineCommand] });
