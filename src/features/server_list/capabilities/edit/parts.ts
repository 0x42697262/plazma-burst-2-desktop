import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { editCommand } from './command.ts';

export const editParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.serverList.edit, commands: [editCommand] });
