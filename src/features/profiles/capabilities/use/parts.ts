import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { useCommand } from './command.ts';

export const useParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.profiles.use, commands: [useCommand] });
