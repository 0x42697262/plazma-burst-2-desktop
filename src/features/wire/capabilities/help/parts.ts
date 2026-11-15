import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { helpCommand } from './command.ts';

export const helpParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.wire.help, commands: [helpCommand] });
