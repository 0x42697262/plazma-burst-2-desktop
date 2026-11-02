import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { minReputationCommand } from './command.ts';

export const minReputationParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.minReputation, commands: [minReputationCommand] });
