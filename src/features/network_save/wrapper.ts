import { CLIENT_DETAILS } from '#shared/clients/keys.ts';
import { CAPABILITY, CLIENT, FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { createSaveWatch } from './services/save-watch.ts';
import { networkSaveInterceptor } from './entry/interceptor.ts';
import { deviceRoutes } from './entry/routes.ts';
import { requestRoutes } from './entry/requests.ts';
import { ACTION } from './keys.ts';

export function networkSaveWrapper(deps: WrapperDeps): WrapperFeature {
  const watch = createSaveWatch();
  const hosts = [...new Set([deps.host, CLIENT_DETAILS[CLIENT.official].host])];
  const capability = CAPABILITY.networkSave;
  const anyOn = (ids: readonly string[]): boolean => ids.some((id) => deps.isCapabilityOn(id));
  const isAllowed = (action: string): boolean => (action === ACTION.load
    ? anyOn([capability.download, capability.diff, capability.restore])
    : anyOn([capability.direct, capability.restore]));
  return Object.freeze({
    id: FEATURE.networkSave,
    routes: [...deviceRoutes({ watch }), ...requestRoutes({ watch, hosts, clock: Date.now, isAllowed })],
    interceptors: [networkSaveInterceptor({ watch, hosts, clock: Date.now, isOn: () => deps.isCapabilityOn(CAPABILITY.networkSave.watch) })],
  });
}
