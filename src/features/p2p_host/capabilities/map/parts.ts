import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { mapCommand } from './command.ts';

export const mapParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.map, commands: [mapCommand] });
