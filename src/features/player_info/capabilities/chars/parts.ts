import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { charsCommand } from './command.ts';

export const charsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.playerInfo.chars, commands: [charsCommand] });
