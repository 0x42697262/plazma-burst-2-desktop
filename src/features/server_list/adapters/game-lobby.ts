import { game } from '#console/kernel/game/bindings.ts';

type LobbyBindings = {
  setLobbyAddress(start: string): void;
  serverLocation(): unknown;
  setServerLocation(text: string): void;
  frameLabel(): string | null;
  setLoginParams(login: string, password: string): void;
};

const bindings = game as unknown as LobbyBindings;

export type GameLobby = LobbyBindings;

export const gameLobby: GameLobby = {
  setLobbyAddress: (start) => bindings.setLobbyAddress(start),
  serverLocation: () => bindings.serverLocation(),
  setServerLocation: (text) => bindings.setServerLocation(text),
  frameLabel: () => bindings.frameLabel(),
  setLoginParams: (login, password) => bindings.setLoginParams(login, password),
};
