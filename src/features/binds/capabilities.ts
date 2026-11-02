import type { CapabilityParts } from '#console/feature-types.ts';
import { bindParts } from './capabilities/bind/parts.ts';
import { keynameParts } from './capabilities/keyname/parts.ts';

export const BINDS_PARTS: readonly CapabilityParts[] = Object.freeze([
  bindParts,
  keynameParts,
]);
