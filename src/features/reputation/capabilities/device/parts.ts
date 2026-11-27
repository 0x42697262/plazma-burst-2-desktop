import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { deviceCommand } from './command.ts';

export const deviceParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.reputation.device, commands: [deviceCommand] });
