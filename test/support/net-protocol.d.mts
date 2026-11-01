export const NET_DIGITS: string;
export function encNum(value: number): string;
export function encSigned(value: number): string;
export function netMsg(type: number, ...parts: string[]): string;
export function netPacket(ack: number, state: string, rel?: [number, string][]): string;

export type FakeSocket = {
  connected: boolean;
  flags: Record<string, boolean>;
  sent: string[];
  io: { engine: { transport: { writable: boolean; name: string } } };
  readonly volatile: FakeSocket;
  emit(event: string, data: string): void;
};

export type FakeConnection = { got: string[]; ping: number; socket: FakeSocket; [method: string]: any };

export function fakeConnection(N: any): FakeConnection;
