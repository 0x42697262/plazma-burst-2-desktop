import path from 'node:path';
import { FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { createFingerprintStore } from './adapters/store.ts';
import { fingerprintRoutes } from './entry/routes.ts';
import { fingerprintDir } from './paths.ts';

export function fingerprintWrapper(deps: WrapperDeps): WrapperFeature {
  const dir = fingerprintDir(deps.isSadburst);
  const store = createFingerprintStore({ dir });
  return Object.freeze({
    id: FEATURE.fingerprint,
    routes: fingerprintRoutes({ store, folderName: path.basename(dir), log: deps.log }),
  });
}
