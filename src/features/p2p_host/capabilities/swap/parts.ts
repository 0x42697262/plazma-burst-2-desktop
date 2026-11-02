import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { swapCommand } from './command.ts';

export const swapParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.swap, commands: [swapCommand] });
