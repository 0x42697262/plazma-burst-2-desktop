import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { pageCommand } from './command.ts';

export const pageParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.serverList.page, commands: [pageCommand] });
