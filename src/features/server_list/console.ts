import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { print } from '../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../desktop/dev/console/core/colors.js';
import { JOIN_TICK_MS } from './constants.ts';
import { PAGE_JOIN_GLOBAL } from './keys.ts';
import { JOIN_TEXT } from './text.ts';
import { serversCommand } from './entry/command.ts';
import { createJoinClient, type JoinTarget } from './services/join-client.ts';
import { gameLobby } from './adapters/game-lobby.ts';

const pageJoinTarget = (): JoinTarget | null => (Reflect.get(globalThis, PAGE_JOIN_GLOBAL) as JoinTarget | undefined) ?? null;

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
