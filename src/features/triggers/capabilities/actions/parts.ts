import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { actionsCommand } from './command.ts';

export const actionsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.actions, commands: [actionsCommand] });
