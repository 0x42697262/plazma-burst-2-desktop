import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { previewCommand } from './command.ts';

export const previewParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.networkSave.preview, commands: [previewCommand] });
