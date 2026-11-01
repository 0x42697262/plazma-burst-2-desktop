import type { WrapperDeps, WrapperFeature } from './feature-types.ts';
import type { createMapCacheWrapper } from '#features/map_cache/wrapper.ts';
import type { createHooksWrapper } from '#features/hooks/wrapper.ts';
import type { ServerListPart } from '#features/server_list/wrapper.ts';
import type { RemotePlayPart } from '#features/remote_play/wrapper.ts';
import type { P2pHostPart } from '#features/p2p_host/wrapper.ts';

type FeatureFactory = (deps: WrapperDeps) => WrapperFeature;

export type WrapperParts = Readonly<Partial<{
  netlogWrapper: FeatureFactory;
  fingerprintWrapper: FeatureFactory;
  screenshotWrapper: FeatureFactory;
  createMapCacheWrapper: typeof createMapCacheWrapper;
  createHooksWrapper: typeof createHooksWrapper;
  serverListPart: ServerListPart;
  remotePlayPart: RemotePlayPart;
  p2pHostPart: P2pHostPart;
}>>;
