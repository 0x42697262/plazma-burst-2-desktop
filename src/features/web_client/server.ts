import { FEATURE } from '#shared/features/keys.ts';
import type { ServerFeature, ServerFeatureContext } from '#server/feature-types.ts';
import { WEB_PAGE_DIR } from './paths.ts';
import { createWebClient } from './services/web-client.ts';

export const webClientServer: ServerFeature = Object.freeze({
  id: FEATURE.webClient,
  http: (context: ServerFeatureContext) => createWebClient({
    gameDir: context.gameDir,
    pageDir: WEB_PAGE_DIR,
    namesScript: context.namesScript,
    serverName: context.config.name,
    publicUrl: context.config.public_url,
    log: context.log,
  }),
});
