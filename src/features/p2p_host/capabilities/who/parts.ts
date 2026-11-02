import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { whoCommands } from './command.ts';

export const whoParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.who, commands: whoCommands });
