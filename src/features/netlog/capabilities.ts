import type { CapabilityParts } from '#console/feature-types.ts';
import { statusParts } from './capabilities/status/parts.ts';
import { showParts } from './capabilities/show/parts.ts';
import { runsParts } from './capabilities/runs/parts.ts';
import { allParts } from './capabilities/all/parts.ts';
import { stateParts } from './capabilities/state/parts.ts';
import { recordParts } from './capabilities/record/parts.ts';

export const NETLOG_PARTS: readonly CapabilityParts[] = Object.freeze([
  statusParts,
  showParts,
  runsParts,
  allParts,
  stateParts,
  recordParts,
]);
