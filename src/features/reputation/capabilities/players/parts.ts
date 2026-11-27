import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { playersCommand } from './command.ts';

export const playersParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.reputation.players, commands: [playersCommand] });
