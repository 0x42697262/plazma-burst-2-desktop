import type { CapabilityParts } from '#console/feature-types.ts';
import { recordParts } from './capabilities/record/parts.ts';
import { stateParts } from './capabilities/state/parts.ts';
import { allParts } from './capabilities/all/parts.ts';

export const NETLOG_PARTS: readonly CapabilityParts[] = Object.freeze([
  recordParts,
  stateParts,
  allParts,
]);
