import { CLIENT_DETAILS } from '#shared/clients/keys.ts';
import { CAPABILITY, CLIENT, FEATURE } from '#shared/features/keys.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { createSaveWatch } from './services/save-watch.ts';
import { networkSaveInterceptor } from './entry/network-save.ts';
import { deviceRoutes } from './entry/routes.ts';

export function reputationWrapper(deps: WrapperDeps): WrapperFeature {
  const watch = createSaveWatch();
  const hosts = [...new Set([deps.host, CLIENT_DETAILS[CLIENT.official].host])];
  return Object.freeze({
    id: FEATURE.reputation,
    routes: deviceRoutes({ watch }),
    interceptors: [networkSaveInterceptor({ watch, hosts, clock: Date.now, isOn: () => deps.isCapabilityOn(CAPABILITY.reputation.device) })],
  });
}
