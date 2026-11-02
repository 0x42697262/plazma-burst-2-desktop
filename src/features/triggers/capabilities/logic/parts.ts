import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts, CommandDefinition } from '#console/feature-types.ts';
import { logicCommand } from './command.ts';

export const logicParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.logic, commands: [logicCommand as CommandDefinition] });
