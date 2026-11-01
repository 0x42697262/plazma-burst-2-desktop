import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { gameCommand } from './entry/command.ts';
import { builtinCommand } from './entry/builtin.ts';

export const gameChatConsole: ConsoleFeature = Object.freeze({ id: FEATURE.gameChat, commands: [gameCommand, builtinCommand] });
