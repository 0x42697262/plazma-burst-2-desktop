import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { startCommand } from './command.ts';

export const startParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.start, commands: [startCommand] });
