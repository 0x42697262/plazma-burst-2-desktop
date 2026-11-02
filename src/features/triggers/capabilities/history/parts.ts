import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { historyCommand } from './command.ts';

export const historyParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.history, commands: [historyCommand], settings: SETTINGS });
