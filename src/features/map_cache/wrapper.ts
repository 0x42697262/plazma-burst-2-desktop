import path from 'node:path';
import { FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { createMapFiles } from './adapters/map-files.ts';
import { mapDownloadInterceptor, mapRoutes } from './entry/routes.ts';
import { mapsDir } from './paths.ts';

export function createMapCacheWrapper(deps: WrapperDeps) {
  const files = createMapFiles({ dir: mapsDir(deps.isSadburst), gameDir: deps.gameDir, kvFile: deps.devKvFile, repoRoot: deps.repoRoot, info: (message) => deps.log.info(message), isCapabilityOn: deps.isCapabilityOn });
  const feature: WrapperFeature = Object.freeze({
    id: FEATURE.mapCache,
    routes: mapRoutes({ files }),
    interceptors: [mapDownloadInterceptor({ files, host: deps.host, info: (message) => deps.log.info(message), error: (message) => deps.log.error(message) })],
  });
  return { feature, findLocalMap: (name: string) => files.findLocal(name), mapsDir: files.dir, relativeMapsDir: path.relative(deps.repoRoot, files.dir) };
}

export type MapCacheWrapper = ReturnType<typeof createMapCacheWrapper>;
