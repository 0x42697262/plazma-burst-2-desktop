import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { playerInfoCommands } from './entry/commands.ts';

export const playerInfoConsole: ConsoleFeature = Object.freeze({ id: FEATURE.playerInfo, commands: playerInfoCommands });
