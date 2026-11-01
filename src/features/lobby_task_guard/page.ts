import { FEATURE } from '#shared/features/keys.ts';
import type { PageFeature } from '#page/feature-types.ts';
import { report } from '#page/report.ts';
import { REPORT_LEVEL } from '#page/keys.ts';
import { gameNetwork } from '#console/kernel/game/network.ts';
import { isJoiningPrivateServer } from '#features/server_list/index.ts';
import { TEXT } from './text.ts';
import { createLobbyTaskGuard } from './services/guard.ts';

const lobbyTaskGuard = createLobbyTaskGuard({
  network: gameNetwork,
  isPrivateLobby: isJoiningPrivateServer,
  report: (count) => { report(TEXT.neutralized(count), REPORT_LEVEL.warn); },
  missing: () => { report(TEXT.missing, REPORT_LEVEL.error); },
});

export const isGuardingPrivateLobby = (): boolean => lobbyTaskGuard.isGuarding();

export const lobbyTaskGuardPage: PageFeature = Object.freeze({
  id: FEATURE.lobbyTaskGuard,
  start: lobbyTaskGuard.start,
});
