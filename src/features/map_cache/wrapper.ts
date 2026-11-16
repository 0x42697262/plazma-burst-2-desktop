import path from 'node:path';
import { CLIENT_DETAILS } from '#shared/clients/keys.ts';
import { CLIENT, FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { createMapFiles } from './adapters/map-files.ts';
import { mapDownloadInterceptor, mapRoutes } from './entry/routes.ts';
import { mapsDir } from './paths.ts';

export function createMapCacheWrapper(deps: WrapperDeps) {
  const files = createMapFiles({ dir: mapsDir(deps.client), gameDir: deps.gameDir, kvFile: deps.devKvFile, repoRoot: deps.repoRoot, info: (message) => deps.log.info(message), isCapabilityOn: deps.isCapabilityOn });
  const feature: WrapperFeature = Object.freeze({
    id: FEATURE.mapCache,
    routes: mapRoutes({ files }),
    interceptors: [mapDownloadInterceptor({ files, hosts: [...new Set([deps.host, CLIENT_DETAILS[CLIENT.official].host])], info: (message) => deps.log.info(message), error: (message) => deps.log.error(message) })],
  });
  return { feature, findLocalMap: (name: string) => files.findLocal(name), mapsDir: files.dir, relativeMapsDir: path.relative(deps.repoRoot, files.dir) };
}

export type MapCacheWrapper = ReturnType<typeof createMapCacheWrapper>;
