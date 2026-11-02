import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { statusCommand, statusSubcommand } from './command.ts';

export const statusParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.status, commands: [statusCommand, statusSubcommand] });
