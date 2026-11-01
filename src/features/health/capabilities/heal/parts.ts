import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { healCommand } from './command.ts';

export const healParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.health.heal, commands: [healCommand] });
