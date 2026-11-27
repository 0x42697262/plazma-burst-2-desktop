import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { relationsCommand } from './command.ts';

export const relationsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.reputation.relations, commands: [relationsCommand] });
