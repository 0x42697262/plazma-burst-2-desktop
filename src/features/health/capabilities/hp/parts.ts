import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { hpCommand } from './command.ts';
import { hpOverride } from './override.ts';

export const hpParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.health.hp, settings: SETTINGS, commands: [hpCommand], overrides: [hpOverride] });
