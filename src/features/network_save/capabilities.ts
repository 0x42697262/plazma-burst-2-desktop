import type { CapabilityParts } from '#console/feature-types.ts';
import { statusParts } from './capabilities/status/parts.ts';
import { previewParts } from './capabilities/preview/parts.ts';
import { diffParts } from './capabilities/diff/parts.ts';
import { downloadParts } from './capabilities/download/parts.ts';
import { uploadParts } from './capabilities/upload/parts.ts';
import { restoreParts } from './capabilities/restore/parts.ts';
import { fieldsParts } from './capabilities/fields/parts.ts';
import { editParts } from './capabilities/edit/parts.ts';

export const NETWORK_SAVE_PARTS: readonly CapabilityParts[] = Object.freeze([
  statusParts,
  previewParts,
  diffParts,
  downloadParts,
  uploadParts,
  restoreParts,
  fieldsParts,
  editParts,
]);
