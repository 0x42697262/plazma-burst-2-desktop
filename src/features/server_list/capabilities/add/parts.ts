import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { addCommand } from './command.ts';

export const addParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.serverList.add, commands: [addCommand] });
