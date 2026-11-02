import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { dropCommand } from './command.ts';

export const dropParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.guns.drop, commands: [dropCommand] });
