import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { builtinCommand } from './command.ts';

export const builtinParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.gameChat.builtin, commands: [builtinCommand] });
