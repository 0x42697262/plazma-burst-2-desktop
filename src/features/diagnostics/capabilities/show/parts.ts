import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { clearCommand, ownCommand, reportCommand, showCommand, statusCommand } from './command.ts';

export const showParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.diagnostics.show, commands: [ownCommand, statusCommand, showCommand, reportCommand, clearCommand] });
