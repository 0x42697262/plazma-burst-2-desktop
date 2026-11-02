import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { connectCommand } from './command.ts';

export const connectParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.serverList.connect, commands: [connectCommand] });
