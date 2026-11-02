import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { unbanallCommand } from './command.ts';

export const unbanallParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.p2pHost.unbanall, commands: [unbanallCommand] });
