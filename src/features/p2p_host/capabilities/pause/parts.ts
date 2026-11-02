import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { pauseCommand } from './command.ts';

export const pauseParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.pause, commands: [pauseCommand] });
