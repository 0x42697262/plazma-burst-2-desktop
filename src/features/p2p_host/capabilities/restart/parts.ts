import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { restartCommand } from './command.ts';

export const restartParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.restart, commands: [restartCommand] });
