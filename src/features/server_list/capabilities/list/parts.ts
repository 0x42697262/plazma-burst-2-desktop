import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { listCommands } from './command.ts';

export const listParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.serverList.list, commands: listCommands });
