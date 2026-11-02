import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { giveCommand } from './command.ts';

export const giveParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.guns.give, commands: [giveCommand] });
