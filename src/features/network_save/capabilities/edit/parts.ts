import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { editCommand } from './command.ts';
import { newUidCommand } from './new-uid.ts';

export const editParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.networkSave.edit, commands: [editCommand, newUidCommand] });
