import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { gameCommand } from './command.ts';

export const gameParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.gameChat.game, commands: [gameCommand] });
