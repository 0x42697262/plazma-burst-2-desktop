import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { HEALTH_PARTS } from './capabilities.ts';

export const healthConsole = consoleFeatureOf(FEATURE.health, HEALTH_PARTS);
