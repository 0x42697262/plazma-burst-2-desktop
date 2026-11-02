import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { statusCommand } from './command.ts';

export const statusParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.scanBypass.status, commands: [statusCommand] });
