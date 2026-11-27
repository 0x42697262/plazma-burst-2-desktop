import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { diffCommand } from './command.ts';

export const diffParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.networkSave.diff, commands: [diffCommand] });
