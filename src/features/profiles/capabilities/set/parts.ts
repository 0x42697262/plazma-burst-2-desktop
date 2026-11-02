import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { setCommands } from './command.ts';

export const setParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.profiles.set, commands: setCommands });
