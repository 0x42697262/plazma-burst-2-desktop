import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { reviveCommand } from './command.ts';

export const reviveParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.health.revive, commands: [reviveCommand] });
