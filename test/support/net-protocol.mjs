export const NET_DIGITS = [...Array(126)].map((_, index) => String.fromCharCode(index + 1)).filter((character) => !['-', '~', '\x01', '\x02'].includes(character)).join('');

export const encNum = (value) => {
  let text = '';
  let rest = value;
  do {
    text = NET_DIGITS[rest % NET_DIGITS.length] + text;
    rest = Math.floor(rest / NET_DIGITS.length);
  } while (rest > 0);
  return text;
};

export const encSigned = (value) => (value < 0 ? `-${encNum(-value)}` : encNum(value));
export const netMsg = (type, ...parts) => [encNum(type), ...parts].join('\x02');
export const netPacket = (ack, state, rel = []) => [String(ack), state, ...rel.flatMap(([uid, data]) => [String(uid), data])].join('\x01');

export function fakeConnection(N) {
  class Conn { [N.connRecv](text) { this.got.push(text); } }
  const connection = new Conn();
  connection.got = [];
  connection.ping = 1000;
  connection.socket = {
    connected: false, flags: {}, sent: [], io: { engine: { transport: { writable: true, name: 'websocket' } } },
    get volatile() { this.flags.volatile = true; return this; },
    emit(event, data) { if (!(this.flags.volatile && !this.io.engine.transport.writable)) this.sent.push(data); this.flags = {}; },
  };
  return connection;
}
