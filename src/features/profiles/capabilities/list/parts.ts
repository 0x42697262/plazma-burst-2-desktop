import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { listCommand } from './command.ts';

export const listParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.profiles.list, commands: [listCommand] });
