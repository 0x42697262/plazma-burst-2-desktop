import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { endroundCommand } from './command.ts';

export const endroundParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.endround, commands: [endroundCommand] });
