import type { WrapperParts } from './feature-parts.ts';
import { netlogWrapper } from '#features/netlog/wrapper.ts';
import { fingerprintWrapper } from '#features/fingerprint/wrapper.ts';
import { screenshotWrapper } from '#features/screenshot/wrapper.ts';
import { createMapCacheWrapper } from '#features/map_cache/wrapper.ts';
import { createHooksWrapper } from '#features/hooks/wrapper.ts';
import { serverListPart } from '#features/server_list/wrapper.ts';
import { remotePlayPart } from '#features/remote_play/wrapper.ts';
import { p2pHostPart } from '#features/p2p_host/wrapper.ts';
import { gameSetupPart } from '#features/game_setup/wrapper.ts';
import { diagnosticsPart } from '#features/diagnostics/wrapper.ts';

export const WRAPPER_PARTS: WrapperParts = Object.freeze({
  netlogWrapper,
  fingerprintWrapper,
  screenshotWrapper,
  createMapCacheWrapper,
  createHooksWrapper,
  serverListPart,
  remotePlayPart,
  p2pHostPart,
  gameSetupPart,
  diagnosticsPart,
});
