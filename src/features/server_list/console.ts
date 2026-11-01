import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { JOIN_TICK_MS } from './constants.ts';
import { JOIN_TEXT } from './text.ts';
import { serversCommand } from './entry/command.ts';
import { createJoinClient } from './services/join-client.ts';
import { pageJoinTarget } from './index.ts';
import { gameLobby } from './adapters/game-lobby.ts';

function startJoin(): void {
  const target = pageJoinTarget();
  if (!target) return;
  const client = createJoinClient({ target, lobby: gameLobby, report: (message) => print(message, COLOR.error) });
  client.tick();
  setInterval(client.tick, JOIN_TICK_MS);
  print(JOIN_TEXT.started(target.address, target.nickname), COLOR.title);
}

export const serverListConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.serverList,
  commands: [serversCommand],
  start: startJoin,
});
