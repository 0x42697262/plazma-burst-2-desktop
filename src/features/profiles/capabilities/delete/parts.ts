import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { deleteCommand } from './command.ts';

export const deleteParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.profiles.delete, commands: [deleteCommand] });
