import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { gunCommands, gunsCommand } from './entry/commands.ts';

export const gunsConsole: ConsoleFeature = Object.freeze({ id: FEATURE.guns, commands: [gunsCommand, ...gunCommands] });
