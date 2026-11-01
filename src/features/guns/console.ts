import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { gunCommands, gunsCommand } from './entry/commands.ts';
import { gunsOverride } from './services/overrides.ts';

export const gunsConsole: ConsoleFeature = Object.freeze({ id: FEATURE.guns, commands: [gunsCommand, ...gunCommands], overrides: [gunsOverride] });
