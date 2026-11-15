import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { sendCommand } from './command.ts';
import { SETTINGS } from './keys.ts';

export const sendParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.wire.send, commands: [sendCommand], settings: SETTINGS });
