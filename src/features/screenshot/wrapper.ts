import { FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { saveWindowShot } from './adapters/window-capture.ts';
import { screenshotRoute } from './entry/route.ts';
import { SCREENSHOT_DIR } from './paths.ts';

export const screenshotWrapper = (deps: WrapperDeps): WrapperFeature => Object.freeze({
  id: FEATURE.screenshot,
  routes: [screenshotRoute({ save: (window) => saveWindowShot(window, SCREENSHOT_DIR, deps.repoRoot), now: () => Date.now() })],
});
