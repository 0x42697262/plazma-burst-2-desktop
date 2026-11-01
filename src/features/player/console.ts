import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { playerCommands } from './entry/commands.ts';

export const playerConsole: ConsoleFeature = Object.freeze({ id: FEATURE.player, commands: playerCommands });
