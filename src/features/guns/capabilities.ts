import type { CapabilityParts } from '#console/feature-types.ts';
import { listParts } from './capabilities/list/parts.ts';
import { giveParts } from './capabilities/give/parts.ts';
import { dropParts } from './capabilities/drop/parts.ts';
import { gunParts } from './capabilities/gun/parts.ts';
import { bulletsParts } from './capabilities/bullets/parts.ts';

export const GUNS_PARTS: readonly CapabilityParts[] = Object.freeze([
  listParts,
  giveParts,
  dropParts,
  gunParts,
  bulletsParts,
]);
