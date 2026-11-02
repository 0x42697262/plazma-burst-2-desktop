import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { pingActionCommand } from './command.ts';

export const pingActionParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.pingAction, commands: [pingActionCommand] });
