import type { CapabilityParts } from '#console/feature-types.ts';
import { triggersParts } from './capabilities/triggers/parts.ts';
import { historyParts } from './capabilities/history/parts.ts';
import { regionsParts } from './capabilities/regions/parts.ts';
import { varsParts } from './capabilities/vars/parts.ts';
import { logicParts } from './capabilities/logic/parts.ts';

export const TRIGGERS_PARTS: readonly CapabilityParts[] = Object.freeze([
  triggersParts,
  historyParts,
  regionsParts,
  varsParts,
  logicParts,
]);
