import type { WrapperDeps, WrapperFeature } from './feature-types.ts';
import { netlogWrapper } from '#features/netlog/wrapper.ts';
import { fingerprintWrapper } from '#features/fingerprint/wrapper.ts';
import { screenshotWrapper } from '#features/screenshot/wrapper.ts';
import { createServerListWrapper, type ServerListWrapper } from '#features/server_list/wrapper.ts';
import type { GameSession } from '#features/server_list/services/server-list.ts';

export type WrapperPorts = Readonly<{ gameSession: GameSession }>;
export type BuiltWrapper = Readonly<{ features: WrapperFeature[]; serverList: ServerListWrapper }>;

export function buildWrapper(deps: WrapperDeps, ports: WrapperPorts): BuiltWrapper {
  const serverList = createServerListWrapper(deps, ports.gameSession);
  return Object.freeze({
    features: [netlogWrapper(deps), fingerprintWrapper(deps), screenshotWrapper(deps), serverList.feature],
    serverList,
  });
}
