import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { keynameCommand } from './command.ts';

export const keynameParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.binds.keyname, commands: [keynameCommand] });
