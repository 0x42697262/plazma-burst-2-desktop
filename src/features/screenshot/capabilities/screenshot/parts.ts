import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { screenshotCommand } from './command.ts';

export const screenshotParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.screenshot.screenshot, commands: [screenshotCommand] });
