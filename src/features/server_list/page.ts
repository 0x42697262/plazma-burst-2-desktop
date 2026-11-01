import { FEATURE } from '#shared/features/keys.ts';
import type { PageFeature } from '#page/feature-types.ts';
import { report } from '#page/report.ts';
import { REPORT_LEVEL } from '#page/keys.ts';
import { JOIN_TICK_MS } from './constants.ts';
import { JOIN_TEXT } from './text.ts';
import { createJoinClient } from './services/join-client.ts';
import { pageJoinTarget } from './index.ts';
import { gameLobby } from './adapters/game-lobby.ts';

function startJoin(): void {
  const target = pageJoinTarget();
  if (!target) return;
  const client = createJoinClient({ target, lobby: gameLobby, report: (message) => { report(message, REPORT_LEVEL.error); } });
  client.tick();
  setInterval(client.tick, JOIN_TICK_MS);
  report(JOIN_TEXT.started(target.address, target.nickname), REPORT_LEVEL.note);
}

export const serverListPage: PageFeature = Object.freeze({
  id: FEATURE.serverList,
  start: startJoin,
});
