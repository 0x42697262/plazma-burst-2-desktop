import { game } from '../../../../desktop/dev/console/game/bindings.js';
import type { GameConnection, GameNetwork, Peer } from '../services/recorder.ts';
import type { StateLayout } from '../domain/state.ts';

type Bindings = {
  connections(): GameConnection[];
  lobbyConnection(): GameConnection | null;
  p2pConnection(): GameConnection | null;
  connPeer(connection: GameConnection): Peer | null;
  connReason(connection: GameConnection): string | null;
  recvMethodName(): string;
  netDigits(): string;
  netTypeName(type: number): string | null;
  stateLayout(): StateLayout | null;
  namesVersion(): string;
};

const bindings = game as unknown as Bindings;

export const gameNetwork: GameNetwork = {
  connections: () => bindings.connections(),
  lobbyConnection: () => bindings.lobbyConnection() || null,
  p2pConnection: () => bindings.p2pConnection(),
  peerOf: (connection) => bindings.connPeer(connection),
  closeReason: (connection) => bindings.connReason(connection),
  receiveMethodName: () => bindings.recvMethodName(),
  digits: () => bindings.netDigits(),
  typeName: (type) => bindings.netTypeName(type),
  stateLayout: () => bindings.stateLayout(),
  namesVersion: () => bindings.namesVersion(),
};
