import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { healthCommands } from './entry/commands.ts';
import { godOverride, hpOverride } from './services/overrides.ts';

export const healthConsole: ConsoleFeature = Object.freeze({ id: FEATURE.health, commands: healthCommands, overrides: [godOverride, hpOverride] });
