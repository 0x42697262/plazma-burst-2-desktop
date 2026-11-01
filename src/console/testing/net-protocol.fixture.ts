const NET_DIGIT_COUNT_BEFORE_EXCLUSIONS = 126;
const CHARACTERS_THE_GAME_KEEPS_OUT_OF_ITS_DIGITS = ['-', '~', '\x01', '\x02'];
const PART_SEPARATOR = '\x02';
const PACKET_SEPARATOR = '\x01';

export const NET_DIGITS = [...Array(NET_DIGIT_COUNT_BEFORE_EXCLUSIONS)]
  .map((_, index) => String.fromCharCode(index + 1))
  .filter((character) => !CHARACTERS_THE_GAME_KEEPS_OUT_OF_ITS_DIGITS.includes(character))
  .join('');

export const encNum = (value: number): string => {
  let text = '';
  let rest = value;
  do {
    text = (NET_DIGITS[rest % NET_DIGITS.length] ?? '') + text;
    rest = Math.floor(rest / NET_DIGITS.length);
  } while (rest > 0);
  return text;
};

export const encSigned = (value: number): string => (value < 0 ? `-${encNum(-value)}` : encNum(value));
export const netMsg = (type: number, ...parts: string[]): string => [encNum(type), ...parts].join(PART_SEPARATOR);
export const netPacket = (ack: number, state: string, rel: [number, string][] = []): string =>
  [String(ack), state, ...rel.flatMap(([uid, data]) => [String(uid), data])].join(PACKET_SEPARATOR);

export type FakeSocket = {
  connected: boolean;
  flags: Record<string, boolean>;
  sent: string[];
  io: { engine: { transport: { writable: boolean; name: string } } };
  readonly volatile: FakeSocket;
  emit(event: string, data: string): void;
};

export type FakeConnection = { got: string[]; ping: number; socket: FakeSocket; [method: string]: any };

export function fakeConnection(names: any): FakeConnection {
  class Connection {
    got: string[] = [];
    ping = 1000;
    socket: FakeSocket = {
      connected: false, flags: {}, sent: [], io: { engine: { transport: { writable: true, name: 'websocket' } } },
      get volatile() { this.flags.volatile = true; return this; },
      emit(_event, data) { if (!(this.flags.volatile && !this.io.engine.transport.writable)) this.sent.push(data); this.flags = {}; },
    };
  }
  const receiveOnThePrototypeAsTheGameHasIt = function (this: Connection, text: string) { this.got.push(text); };
  Object.defineProperty(Connection.prototype, names.connRecv, { value: receiveOnThePrototypeAsTheGameHasIt, writable: true, configurable: true });
  return new Connection();
}
