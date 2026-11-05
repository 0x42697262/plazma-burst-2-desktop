import type { CapabilityParts } from '#console/feature-types.ts';
import { showParts } from './capabilities/show/parts.ts';
import { sendParts } from './capabilities/send/parts.ts';

export const DIAGNOSTICS_PARTS: readonly CapabilityParts[] = Object.freeze([
  showParts,
  sendParts,
]);
