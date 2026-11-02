import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { GUNS_PARTS } from './capabilities.ts';

export const gunsConsole = consoleFeatureOf(FEATURE.guns, GUNS_PARTS);
