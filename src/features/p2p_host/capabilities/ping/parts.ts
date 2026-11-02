import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { pingCommand } from './command.ts';

export const pingParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.ping, commands: [pingCommand] });
