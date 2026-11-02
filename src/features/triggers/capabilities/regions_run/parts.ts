import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { regionsRunCommand } from './command.ts';

export const regionsRunParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.regionsRun, commands: [regionsRunCommand] });
