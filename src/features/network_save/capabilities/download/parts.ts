import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { downloadCommand } from './command.ts';

export const downloadParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.networkSave.download, commands: [downloadCommand] });
