import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTINGS } from './keys.ts';
import { flyOverride } from './override.ts';
import { flyCommand } from './command.ts';

export const flyParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.movement.fly, settings: SETTINGS, overrides: [flyOverride], commands: [flyCommand] });
