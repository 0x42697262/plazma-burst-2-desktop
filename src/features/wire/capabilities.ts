import type { CapabilityParts } from '#console/feature-types.ts';
import { sendParts } from './capabilities/send/parts.ts';
import { listParts } from './capabilities/list/parts.ts';
import { helpParts } from './capabilities/help/parts.ts';

export const WIRE_PARTS: readonly CapabilityParts[] = Object.freeze([
  sendParts,
  listParts,
  helpParts,
]);
