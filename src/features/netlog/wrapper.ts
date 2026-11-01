import { FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { createNetLogFiles } from './adapters/log-files.ts';
import { netlogRoutes } from './entry/routes.ts';
import { NETLOG_DIR } from './paths.ts';

export function netlogWrapper(deps: WrapperDeps): WrapperFeature {
  const files = createNetLogFiles({ dir: NETLOG_DIR, version: deps.gameVersion });
  return Object.freeze({
    id: FEATURE.netlog,
    routes: netlogRoutes({ files, repoRoot: deps.repoRoot, isSadburst: deps.isSadburst, log: deps.log }),
  });
}
