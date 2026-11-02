import type { CapabilityParts } from '#console/feature-types.ts';
import { screenshotParts } from './capabilities/screenshot/parts.ts';
import { keyParts } from './capabilities/key/parts.ts';

export const SCREENSHOT_PARTS: readonly CapabilityParts[] = Object.freeze([
  screenshotParts,
  keyParts,
]);
