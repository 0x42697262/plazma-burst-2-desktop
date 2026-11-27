import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { fieldsCommand } from './command.ts';

export const fieldsParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.networkSave.fields, commands: [fieldsCommand] });
