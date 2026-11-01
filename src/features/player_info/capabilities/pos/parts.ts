import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { posCommand } from './command.ts';

export const posParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.playerInfo.pos, commands: [posCommand] });
