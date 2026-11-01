import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { hpCommand } from './command.ts';
import { hpOverride } from './override.ts';

export const hpParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.health.hp, commands: [hpCommand], overrides: [hpOverride] });
