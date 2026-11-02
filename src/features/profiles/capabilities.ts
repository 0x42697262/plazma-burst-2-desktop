import type { CapabilityParts } from '#console/feature-types.ts';
import { statusParts } from './capabilities/status/parts.ts';
import { listParts } from './capabilities/list/parts.ts';
import { showParts } from './capabilities/show/parts.ts';
import { useParts } from './capabilities/use/parts.ts';
import { setParts } from './capabilities/set/parts.ts';
import { bindParts } from './capabilities/bind/parts.ts';
import { onloadParts } from './capabilities/onload/parts.ts';
import { deleteParts } from './capabilities/delete/parts.ts';

export const PROFILES_PARTS: readonly CapabilityParts[] = Object.freeze([
  statusParts,
  listParts,
  showParts,
  useParts,
  setParts,
  bindParts,
  onloadParts,
  deleteParts,
]);
