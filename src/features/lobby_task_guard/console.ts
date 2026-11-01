import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { gameNetwork } from '#console/kernel/game/network.ts';
import { print } from '../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../desktop/dev/console/core/colors.js';
import { isJoiningPrivateServer } from '#features/server_list/index.ts';
import { TEXT } from './text.ts';
import { createLobbyTaskGuard } from './services/guard.ts';

export const lobbyTaskGuard = createLobbyTaskGuard({
  network: gameNetwork,
  isPrivateLobby: isJoiningPrivateServer,
  report: (count) => print(TEXT.neutralized(count), COLOR.warn),
  missing: () => print(TEXT.missing, COLOR.error),
});

export const lobbyTaskGuardConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.lobbyTaskGuard,
  start: lobbyTaskGuard.start,
});
