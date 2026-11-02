import type { CapabilityParts } from '#console/feature-types.ts';
import { statusParts } from './capabilities/status/parts.ts';
import { checksParts } from './capabilities/checks/parts.ts';

export const SCAN_BYPASS_PARTS: readonly CapabilityParts[] = Object.freeze([
  statusParts,
  checksParts,
]);
