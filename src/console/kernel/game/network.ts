import { game } from '../../../../desktop/dev/console/game/bindings.js';
import { read } from '../../../../desktop/dev/console/game/names.js';
import { CONNECTION_CLASS_NAME } from './keys.ts';

export type StateLayout = Partial<Record<'x' | 'y' | 'hp' | 'aimX' | 'aimY' | 'headHp' | 'faceHp' | 'killer' | 'clock' | 'respawns' | 'velScale', number | null>>;
export type Socket = {
  connected?: boolean;
  flags?: { volatile?: boolean };
  io?: { engine?: { transport?: { writable?: boolean; name?: string } } };
  [method: string]: unknown;
};
export type Peer = { connected?: boolean; [method: string]: unknown };
export type GameConnection = { socket?: Socket | null; ping?: unknown; [field: string]: unknown };

export type GameNetwork = {
  connections(): readonly GameConnection[];
  lobbyConnection(): GameConnection | null;
  p2pConnection(): GameConnection | null;
  peerOf(connection: GameConnection): Peer | null;
  closeReason(connection: GameConnection): string | null;
  receiveMethodName(): string;
  digits(): string;
  typeName(type: number): string | null;
  stateLayout(): StateLayout | null;
  namesVersion(): string;
  buildTag(): string;
  connectionPrototype(): object | null;
};

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
  buildTag(): unknown;
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
  buildTag: () => String(bindings.buildTag()),
  connectionPrototype: () => {
    const connectionClass = (read as (key: string) => unknown)(CONNECTION_CLASS_NAME);
    return typeof connectionClass === 'function' ? connectionClass.prototype as object : null;
  },
};
