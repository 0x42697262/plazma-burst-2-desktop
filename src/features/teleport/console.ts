import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { teleportCommand } from './entry/command.ts';

export const teleportConsole: ConsoleFeature = Object.freeze({ id: FEATURE.teleport, commands: [teleportCommand] });
