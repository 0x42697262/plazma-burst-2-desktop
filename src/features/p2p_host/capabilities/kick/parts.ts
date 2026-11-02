import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { kickCommands } from './command.ts';

export const kickParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.kick, commands: kickCommands });
