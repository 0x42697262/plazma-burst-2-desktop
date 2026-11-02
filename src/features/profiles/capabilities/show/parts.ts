import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { showCommand } from './command.ts';

export const showParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.profiles.show, commands: [showCommand] });
