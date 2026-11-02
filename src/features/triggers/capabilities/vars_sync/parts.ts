import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { varsSyncCommand } from './command.ts';

export const varsSyncParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.varsSync, commands: [varsSyncCommand] });
