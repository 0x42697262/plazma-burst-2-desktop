import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { SCREENSHOT_PARTS } from './capabilities.ts';

export const screenshotConsole = consoleFeatureOf(FEATURE.screenshot, SCREENSHOT_PARTS);
