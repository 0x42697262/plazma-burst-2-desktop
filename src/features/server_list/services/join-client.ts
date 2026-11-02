import { JOIN_STARTUP_FRAMES, OFFICIAL_LOCATION, lobbyAddressOf } from '../keys.ts';
import { JOIN_TEXT } from '../text.ts';
import type { GameLobby } from '../adapters/game-lobby.ts';

import type { JoinTarget } from '#page/join-target.ts';

export type { JoinTarget };

export type JoinClientDeps = {
  target: JoinTarget;
  lobby: GameLobby;
  report: (message: string) => void;
};

export function createJoinClient({ target, lobby, report }: JoinClientDeps) {
  let isLoginSet = false;
  let hasReported = false;

  function tick(): void {
    lobby.setLobbyAddress(lobbyAddressOf(target.address));
    if (lobby.serverLocation() === OFFICIAL_LOCATION) lobby.setServerLocation(JOIN_TEXT.location(target.address));
    const isPastStartup = !JOIN_STARTUP_FRAMES.includes(lobby.frameLabel());
    if (!isLoginSet && isPastStartup) {
      lobby.setLoginParams(target.nickname, target.password);
      isLoginSet = true;
    }
  }

  function guardedTick(): void {
    try {
      tick();
    } catch (error) {
      if (hasReported) return;
      hasReported = true;
      report(JOIN_TEXT.failed((error as Error).message));
    }
  }

  return { tick: guardedTick };
}
