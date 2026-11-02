import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { sayCommands } from './command.ts';

export const sayParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.say, commands: sayCommands });
