import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { tellCommand } from './command.ts';

export const tellParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.tell, commands: [tellCommand] });
