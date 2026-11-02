import type { CapabilityParts } from '#console/feature-types.ts';
import { runParts } from './capabilities/run/parts.ts';
import { listParts } from './capabilities/list/parts.ts';

export const FINGERPRINT_PARTS: readonly CapabilityParts[] = Object.freeze([
  runParts,
  listParts,
]);
