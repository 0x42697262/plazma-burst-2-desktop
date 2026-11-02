import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { bindCommands } from './command.ts';

export const bindParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.profiles.bind, commands: bindCommands });
