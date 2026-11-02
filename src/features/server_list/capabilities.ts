import type { CapabilityParts } from '#console/feature-types.ts';
import { listParts } from './capabilities/list/parts.ts';
import { connectParts } from './capabilities/connect/parts.ts';
import { addParts } from './capabilities/add/parts.ts';
import { editParts } from './capabilities/edit/parts.ts';
import { removeParts } from './capabilities/remove/parts.ts';
import { fingerprintParts } from './capabilities/fingerprint/parts.ts';
import { pageParts } from './capabilities/page/parts.ts';

export const SERVER_LIST_PARTS: readonly CapabilityParts[] = Object.freeze([
  listParts,
  connectParts,
  addParts,
  editParts,
  removeParts,
  fingerprintParts,
  pageParts,
]);
