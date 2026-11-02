import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { mapsCommand } from './command.ts';

export const mapsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.mapCache.maps, commands: [mapsCommand] });
