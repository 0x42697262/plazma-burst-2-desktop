import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { backupsCommand, restoreCommand } from './command.ts';

export const restoreParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.networkSave.restore, commands: [restoreCommand, backupsCommand] });
