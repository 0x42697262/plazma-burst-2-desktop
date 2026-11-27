import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { uploadCommand } from './command.ts';

export const uploadParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.networkSave.upload, commands: [uploadCommand] });
