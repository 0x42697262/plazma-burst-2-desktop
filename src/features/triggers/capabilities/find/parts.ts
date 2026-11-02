import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { findCommand } from './command.ts';

export const findParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.find, commands: [findCommand] });
