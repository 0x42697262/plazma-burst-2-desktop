import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { MOVEMENT_PARTS } from './capabilities.ts';

export const movementConsole = consoleFeatureOf(FEATURE.movement, MOVEMENT_PARTS);
