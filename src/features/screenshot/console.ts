import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { screenshotCommand } from './entry/command.ts';

export const screenshotConsole: ConsoleFeature = Object.freeze({ id: FEATURE.screenshot, commands: [screenshotCommand] });
