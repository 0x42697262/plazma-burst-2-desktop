import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { uidCommand } from './command.ts';

export const uidParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.playerInfo.uid, commands: [uidCommand] });
