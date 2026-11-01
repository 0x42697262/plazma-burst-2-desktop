import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { movementOverride } from './overrides.ts';

export const movementConsole: ConsoleFeature = Object.freeze({ id: FEATURE.movement, overrides: [movementOverride] });
