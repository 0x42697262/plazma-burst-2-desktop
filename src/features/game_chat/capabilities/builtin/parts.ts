import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { builtinCommand } from './command.ts';

export const builtinParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.gameChat.builtin, settings: SETTINGS, commands: [builtinCommand] });
