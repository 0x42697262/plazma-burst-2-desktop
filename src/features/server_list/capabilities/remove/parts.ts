import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { removeCommand } from './command.ts';

export const removeParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.serverList.remove, commands: [removeCommand] });
