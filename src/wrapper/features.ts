import type { WrapperDeps, WrapperFeature } from './feature-types.ts';
import { netlogWrapper } from '#features/netlog/wrapper.ts';
import { fingerprintWrapper } from '#features/fingerprint/wrapper.ts';
import { screenshotWrapper } from '#features/screenshot/wrapper.ts';
import { createServerListWrapper, type ServerListWrapper } from '#features/server_list/wrapper.ts';
import { createMapCacheWrapper, type MapCacheWrapper } from '#features/map_cache/wrapper.ts';
import { createHooksWrapper, type HooksPorts, type HooksWrapper } from '#features/hooks/wrapper.ts';
import type { GameSession } from '#features/server_list/services/server-list.ts';

export type WrapperPorts = Readonly<{ gameSession: GameSession; hooks: HooksPorts }>;
export type BuiltWrapper = Readonly<{ features: WrapperFeature[]; serverList: ServerListWrapper; mapCache: MapCacheWrapper; hooks: HooksWrapper }>;

export function buildWrapper(deps: WrapperDeps, ports: WrapperPorts): BuiltWrapper {
  const serverList = createServerListWrapper(deps, ports.gameSession);
  const mapCache = createMapCacheWrapper(deps);
  const hooks = createHooksWrapper(deps, ports.hooks);
  return Object.freeze({
    features: [netlogWrapper(deps), fingerprintWrapper(deps), screenshotWrapper(deps), serverList.feature, mapCache.feature, hooks.feature],
    serverList,
    mapCache,
    hooks,
  });
}
