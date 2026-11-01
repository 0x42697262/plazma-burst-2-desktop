import { enabledPageFeatures } from './features.ts';
import { whenGameReady } from './ready.ts';

const features = enabledPageFeatures();
whenGameReady(() => {
  for (const feature of features) feature.start();
});
