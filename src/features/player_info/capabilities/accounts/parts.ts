import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { accountsCommand } from './command.ts';

export const accountsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.playerInfo.accounts, commands: [accountsCommand] });
