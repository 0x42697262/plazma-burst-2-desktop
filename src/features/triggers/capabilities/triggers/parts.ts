import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts, CommandDefinition } from '#console/feature-types.ts';
import { triggersCommand } from './command.ts';

export const triggersParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.list, commands: [triggersCommand as CommandDefinition] });
