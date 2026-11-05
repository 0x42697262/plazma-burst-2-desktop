import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { configCommand, sendCommand } from './command.ts';

export const sendParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.diagnostics.send, commands: [sendCommand, configCommand] });
