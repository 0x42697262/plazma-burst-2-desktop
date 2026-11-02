import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { stopCommand } from './command.ts';

export const stopParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.stop, commands: [stopCommand] });
