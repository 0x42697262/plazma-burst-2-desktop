import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '../../../test/fake-game.mjs';
import { NET_DIGITS, encNum, netMsg, netPacket, fakeConnection } from '../../../test/support/net-protocol.mjs';
import type { Recorder, GameNetwork } from './services/recorder.ts';
import { createRecorder } from './services/recorder.ts';
import { methodWrapper } from './adapters/method-wrap.ts';

type Game = Awaited<ReturnType<typeof bootConsole>>;
type Connection = ReturnType<typeof fakeConnection>;

let game: Game;
let settingsOf: (key: string) => unknown;
let gameNetwork: GameNetwork;

before(async () => {
  game = await bootConsole();
  ({ gameNetwork } = await import('#console/kernel/game/network.ts'));
  const store = await import('#console/kernel/state/store.ts');
  settingsOf = (key) => (store.settings as { effective(key: string): unknown }).effective(key);
});

function recorderWithClock(start: number): { recorder: Recorder; advance(by: number): number; at(): number } {
  let now = start;
  const recorder = createRecorder({
    network: gameNetwork,
    settings: {
      recording: () => settingsOf('net_log') === true,
      everything: () => settingsOf('net_log_all') === true,
      states: () => settingsOf('net_log_state') === true,
    },
    sink: { send: async () => ({ run: 'test-run', file: 'netlogs/test-run.log' }), beacon: () => true },
    methods: methodWrapper,
    onPageHide: () => undefined,
    warn: () => undefined,
    now: () => now,
  });
  return { recorder, advance: (by) => (now += by), at: () => now };
}

const net = () => game.G[game.N.net] as Record<string, unknown> & { connections: Connection[] };
const withoutTime = (lines: readonly string[]) => lines.map((line) => line.slice(14));

test('the network recorder logs messages readably and every kind of packet loss, not the normal repeats', () => {
  const { N } = game;
  const network = net();
  network[N.netDigits] = NET_DIGITS;
  network[N.netTypeNames] = { 0: 'RELIABLE_RESPONSE', 5: 'RELIABLE_CHAT' };
  const conn = fakeConnection(N);
  const emit = conn.socket.emit;
  const clock = recorderWithClock(Date.now());
  const { recorder } = clock;
  network.connections = [];
  recorder.tick();
  network.connections = [conn];
  network[N.lobbyConn] = conn;
  const since = recorder.lines().length;
  try {
    recorder.tick();
    conn.socket.connected = true;
    conn.ping = 100;
    recorder.tick(clock.advance(50));
    const chat = netPacket(-1, '', [[0, netMsg(5, 'hello | world', encNum(7), 'plain text')]]);
    conn.socket.volatile.emit('m', chat);
    clock.advance(16);
    conn.socket.volatile.emit('m', chat);
    conn.socket.io.engine.transport.writable = false;
    conn.socket.volatile.emit('m', netPacket(-1, netMsg(1, 'x'), []));
    conn.socket.io.engine.transport.writable = true;
    clock.advance(884);
    conn[N.connRecv](netPacket(0, '', [[0, netMsg(0, encNum(150))], [2, netMsg(5, 'b')]]));
    conn[N.connRecv](netPacket(0, '', [[1, netMsg(5, 'a')]]));
    conn[N.connRecv](netPacket(0, '', [[1, netMsg(5, 'a')]]));
    assert.equal(conn.got.length, 3, 'the game still gets every packet');
    assert.equal(conn.socket.sent.length, 2, 'and the socket still sends');
    conn.socket.volatile.emit('m', netPacket(2, '', [[1, netMsg(5, 'anyone?')]]));
    recorder.tick(clock.advance(1000));
    recorder.tick(clock.advance(1100));
    recorder.tick(clock.advance(500));
    conn[N.connReason] = 'io server disconnect';
    network.connections = [];
    recorder.tick(clock.advance(50));
    const out = withoutTime(recorder.lines().slice(since));
    const want = [
      /^c\d+ server +--- +CONN +new connection \(socket\.io over websocket\)$/,
      /^c\d+ server +--- +CONN +connected/,
      /^c\d+ server +OUT +REL +#0 CHAT\("hello \| world", 7, "plain text"\)$/,
      /^c\d+ server +OUT +LOSS +dropped: the socket was busy.*0 reliable messages.*its state update is lost\)$/,
      /^c\d+ server +OUT +LOSS +slow ack: #0 CHAT acknowledged after 900 ms, ping 100 ms \(sent 2 times\): packets or acks were lost on the way$/,
      /^c\d+ server +IN +REL +#0 RESPONSE\(150\)$/,
      /^c\d+ server +IN +REL +#2 CHAT\("b"\)$/,
      /^c\d+ server +IN +LOSS +gap: #2 arrived before #1 \(1 missing: lost or out of order\)$/,
      /^c\d+ server +IN +REL +#1 CHAT\("a"\)$/,
      /^c\d+ server +IN +LOSS +late #1 arrived \d+ ms after the gap was seen$/,
      /^c\d+ server +OUT +REL +#1 CHAT\("anyone\?"\)$/,
      /^c\d+ server +--- +STAT +ping 100 ms \| acks in 900 ms \| out 4 packets .* \| in 3 packets .* \| repeated 1 out, 1 in \| loss: 1 slow ack, 1 dropped, 1 gap, 1 late \| 1 waiting for ack$/,
      /^c\d+ server +OUT +LOSS +no ack: #1 CHAT not acknowledged after 2100 ms \(sent 1 time\): nothing is getting through$/,
      /^c\d+ server +--- +CONN +closed: io server disconnect \(the server closed the connection on purpose\) \| after .* \| acks in 900 ms \| loss: 1 slow ack, 1 no ack, 1 dropped, 1 gap, 1 late$/,
    ];
    assert.equal(out.length, want.length, out.join('\n'));
    want.forEach((pattern, index) => assert.match(out[index] ?? '', pattern));
    assert.ok(!Object.hasOwn(conn, N.connRecv) && conn.socket.emit === emit, 'a closed connection is unwrapped');
  } finally {
    network.connections = [];
  }
});

test('net_log off unwraps every connection and stops recording; on starts again', () => {
  const { N } = game;
  const network = net();
  const conn = fakeConnection(N);
  const emit = conn.socket.emit;
  conn.socket.connected = true;
  network.connections = [conn];
  const clock = recorderWithClock(Date.now() + 100000);
  const { recorder } = clock;
  try {
    recorder.tick(clock.at());
    assert.ok(Object.hasOwn(conn, N.connRecv), 'wrapped while on');
    game.run('net_log off');
    recorder.tick(clock.advance(50));
    assert.ok(!Object.hasOwn(conn, N.connRecv) && conn.socket.emit === emit, 'unwrapped when off');
    assert.match(recorder.lines().at(-1) ?? '', /PAGE +recording off \(net_log off\)$/);
    const count = recorder.lines().length;
    conn[N.connRecv](netPacket(0, '', [[0, netMsg(5, 'x')]]));
    assert.equal(recorder.lines().length, count, 'nothing recorded while off');
    game.run('net_log on');
    recorder.tick(clock.advance(50));
    const back = recorder.lines().slice(count).join('\n');
    assert.match(back, /PAGE +recording on/);
    assert.match(back, /CONN +already connected when recording started/);
    conn[N.connRecv](netPacket(0, '', [[40, netMsg(5, 'y')]]));
    assert.doesNotMatch(recorder.lines().slice(count).join('\n'), /gap/);
  } finally {
    game.run('unset net_log');
    network.connections = [];
    recorder.tick(clock.advance(50));
  }
});

test('net_log_all (off by default) adds a PKT line per packet and every state update, decoded', () => {
  const { N } = game;
  const network = net();
  network[N.netDigits] = NET_DIGITS;
  network[N.netTypeNames] = { 5: 'RELIABLE_CHAT' };
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  network.connections = [conn];
  const clock = recorderWithClock(Date.now() + 300000);
  const { recorder } = clock;
  try {
    recorder.tick(clock.at());
    const since = recorder.lines().length;
    const fresh = () => withoutTime(recorder.lines().slice(since));
    conn[N.connRecv](netPacket(3, netMsg(1, encNum(250), 'x'), []));
    assert.deepEqual(fresh(), []);
    game.run('net_log_all on');
    conn[N.connRecv](netPacket(3, netMsg(1, encNum(250), 'x'), []));
    conn.socket.volatile.emit('m', netPacket(-1, '', [[0, netMsg(5, 'hi')], [1, netMsg(5, 'yo')]]));
    const out = fresh();
    assert.equal(out.length, 5, out.join('\n'));
    assert.match(out[0] ?? '', /IN +PKT +8 chars \| ack #3 \| state \(3 parts\) 6 chars \| framing 2 chars$/);
    assert.match(out[1] ?? '', /IN +STATE +\(1, 250, "x"\)$/);
    assert.match(out[2] ?? '', /OUT +PKT +17 chars \| ack none \| #0 CHAT 4 chars, #1 CHAT 4 chars \| framing 9 chars$/);
    assert.match(out[3] ?? '', /OUT +REL +#0 CHAT\("hi"\)$/);
  } finally {
    game.run('unset net_log_all');
    network.connections = [];
    recorder.tick(clock.advance(50));
  }
});

test('a part over 2000 characters is cut in the log, except with net_log_all', () => {
  const { N } = game;
  const network = net();
  network[N.netDigits] = NET_DIGITS;
  network[N.netTypeNames] = { 4: 'RELIABLE_TASK' };
  const code = '( v )=>{ return v; }'.padEnd(7370, ' ');
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  network.connections = [conn];
  const clock = recorderWithClock(Date.now() + 350000);
  const { recorder } = clock;
  try {
    recorder.tick(clock.at());
    const since = recorder.lines().length;
    const rel = () => recorder.lines().slice(since).filter((line) => / REL /.test(line)).at(-1) ?? '';
    conn[N.connRecv](netPacket(-1, '', [[0, netMsg(4, code, 'r')]]));
    assert.match(rel(), /\.\.\.\(7370 chars\), "r"\)$/);
    game.run('net_log_all on');
    conn[N.connRecv](netPacket(-1, '', [[1, netMsg(4, code, 'r')]]));
    assert.ok(rel().endsWith(`#1 TASK(${JSON.stringify(code)}, "r")`), rel().slice(-80));
  } finally {
    game.run('unset net_log_all');
    network.connections = [];
    recorder.tick(clock.advance(50));
  }
});

test('a RESPONSE says which request it answers; the login password is never written; the PKT line adds up', () => {
  const { N } = game;
  const network = net();
  network[N.netDigits] = NET_DIGITS;
  network[N.netTypeNames] = { 0: 'RELIABLE_RESPONSE', 3: 'RELIABLE_AUTHENTICATE', 26: 'RELIABLE_PING' };
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  network.connections = [conn];
  const clock = recorderWithClock(Date.now() + 400000);
  const { recorder } = clock;
  try {
    recorder.tick(clock.at());
    game.run('net_log_all on');
    const since = recorder.lines().length;
    conn.socket.volatile.emit('m', netPacket(-1, '', [[0, netMsg(3, '.guest', 'hunter2-password-hash', encNum(100), 'x')]]));
    const answer = netPacket(0, '', [[0, netMsg(0, encNum(100), 'fail', 'Server: Unknown error [2]')]]);
    assert.equal(answer.length, 39);
    conn[N.connRecv](answer);
    conn[N.connRecv](netPacket(0, '', [[1, netMsg(26, encNum(7))]]));
    conn.socket.volatile.emit('m', netPacket(1, '', [[1, netMsg(0, encNum(7))]]));
    const out = withoutTime(recorder.lines().slice(since));
    assert.match(out[1] ?? '', /OUT +REL +#0 AUTHENTICATE\(".guest", "‹redacted›", "h", "x"\)$/);
    assert.ok(!recorder.lines().some((line) => line.includes('hunter2')), 'the password is in no line');
    assert.match(out[2] ?? '', /IN +PKT +39 chars \| ack #0 \| #0 RESPONSE 34 chars \| framing 5 chars$/);
    assert.match(out[3] ?? '', /IN +REL +#0 RESPONSE\(100, "fail", "Server: Unknown error \[2\]"\) {2}<- answers #0 AUTHENTICATE \(its part 3, "h", was callback ID 100\), \d+ ms later$/);
    assert.match(out[7] ?? '', /OUT +REL +#1 RESPONSE\(7\) {2}<- answers #1 PING \(its part 1, "\\n", was callback ID 7\), \d+ ms later$/);
  } finally {
    game.run('unset net_log_all');
    network.connections = [];
    recorder.tick(clock.advance(50));
  }
});

const LAYOUT = Object.freeze({ x: 1, y: 2, hp: 6, aimX: 7, aimY: 8, headHp: 12, faceHp: 13, killer: 16, clock: 19, respawns: 20, velScale: 5 });
const LAYOUT_NAMES = Object.freeze({ x: 'stateX', y: 'stateY', hp: 'stateHp', aimX: 'stateAimX', aimY: 'stateAimY', headHp: 'stateHeadHp', faceHp: 'stateFaceHp', killer: 'stateKiller', clock: 'stateClock', respawns: 'stateRespawns', velScale: 'stateVelScale' });

test('STATE lines on the main server connection are labelled: your state out, the snapshot in', async (context) => {
  const { N } = game;
  const { playerState } = await import('./state.fixture.ts');
  const network = net();
  network[N.netDigits] = NET_DIGITS;
  for (const [key, name] of Object.entries(LAYOUT_NAMES)) network[N[name]] = LAYOUT[key as keyof typeof LAYOUT];
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  network.connections = [conn];
  network[N.lobbyConn] = conn;
  const clock = recorderWithClock(Date.now() + 600000);
  const { recorder } = clock;
  context.after(() => { game.run('unset net_log_state'); network.connections = []; delete network[N.lobbyConn]; recorder.tick(clock.advance(999999)); });
  recorder.tick(clock.at());
  game.run('net_log_state on');
  const since = recorder.lines().length;
  conn.socket.volatile.emit('m', netPacket(-1, playerState({ hp: 150 }).join('\x02')));
  conn[N.connRecv](netPacket(-1, [encNum(0), encNum(0), encNum(150), `${encNum(45)}~${encNum(0)}~${encNum(0)}`, encNum(0)].join('\x02')));
  const out = withoutTime(recorder.lines().slice(since));
  assert.match(out[0] ?? '', /^c\d+ server +OUT +STATE +hp 150 \| respawns 1 \| aim \+212,-40 \|/);
  assert.match(out[1] ?? '', /^c\d+ server +IN +STATE +#0 hp 150 ping 45 ms$/);
});
