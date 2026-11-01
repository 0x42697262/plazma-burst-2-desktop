import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { NET_DIGITS, encNum, netMsg, netPacket, fakeConnection } from '#console/testing/net-protocol.fixture.ts';
import type { Recorder } from './services/recorder.ts';

type Game = Awaited<ReturnType<typeof bootConsole>>;
let game: Game;
let recorder: Recorder;

before(async () => {
  game = await bootConsole();
  ({ recorder } = await import('./console.ts'));
});

const printed = () => (game.log.printed).filter((line) => !line.startsWith('> '));
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('netlog: status, the last lines with filters, other instances and on/off', async () => {
  const { G, N } = game;
  const network = G[N.net] as Record<string, unknown>;
  network[N.netDigits] = NET_DIGITS;
  network[N.netTypeNames] = { 5: 'RELIABLE_CHAT', 9: 'RELIABLE_SHOT' };
  const conn = fakeConnection(N);
  network.connections = [conn];
  network[N.lobbyConn] = conn;
  const realFetch = G.fetch;
  let time = Date.now() + 200000;
  const since = recorder.lines().length;
  const last = () => `last:${recorder.lines().length - since}`;
  try {
    recorder.tick(time);
    conn.socket.connected = true;
    conn.ping = 45;
    recorder.tick(time += 50);
    conn.socket.volatile.emit('m', netPacket(-1, '', [[0, netMsg(5, 'hello there')], [1, netMsg(9, encNum(3))]]));
    conn[N.connRecv](netPacket(1, '', [[0, netMsg(5, 'hi back')], [2, netMsg(9, encNum(4))]]));

    const status = game.run('netlog');
    assert.match(status[0] ?? '', /^Network log: on \(net_log\)\. Everything \(every packet and state update\): off \(net_log_all\)\. State updates: counted only \(net_log_state\)\.$/);
    assert.ok(status.some((line) => /^ {2}c\d+ server +connected, ping 45 ms, out 1 packets, in 1 packets \| loss: 1 gap \| 1 missing$/.test(line)), status.join('\n'));

    const chat = game.run(`netlog show type:chat ${last()}`);
    assert.match(chat[0] ?? '', /^Network log, this page: 2 of the last \d+ lines match\.$/);
    assert.match(chat[1] ?? '', /OUT +REL +#0 CHAT\("hello there"\)$/);
    assert.match(chat[2] ?? '', /IN +REL +#0 CHAT\("hi back"\)$/);
    assert.equal((game.run(`net show --in hi ${last()}`)).length, 3);
    assert.match((game.run(`netlog show --loss ${last()}`))[1] ?? '', /LOSS +gap: #2 arrived before #1/);
    assert.match((game.run(`netlog show --out type:shot ${last()}`))[1] ?? '', / SHOT\(3\)$/);
    assert.match((game.run('netlog show --in --out'))[0] ?? '', /^error: --in and --out do not go together/);
    assert.match((game.run('netlog show nothing-like-this'))[1] ?? '', /Nothing matches/);

    const asked: string[] = [];
    G.fetch = (url: string) => {
      asked.push(url);
      if (url.includes('netruns')) {
        return Promise.resolve({ ok: true, json: async () => [
          { name: '2026-11-01_05-30-12_local', size: 2048, updated: Date.now(), active: true, mine: true, current: true },
          { name: '2026-11-01_05-31-00_local', size: 4096, updated: Date.now() - 2000, active: true, mine: false, current: false },
        ] });
      }
      return Promise.resolve({ ok: true, text: async () => [
        '05:31:01.000  c1 server     OUT  REL    #0 CHAT("from the other app")',
        '05:31:02.000  c1 server     OUT  LOSS   resend #0 CHAT (try 2, first sent 2001 ms ago, not acknowledged yet)',
      ].join('\n') });
    };
    game.run('netlog runs');
    await settle();
    const list = printed();
    assert.match(list[0] ?? '', /^Network logs in data\/netlogs\/, newest first \(2\)/);
    assert.match(list[1] ?? '', /^ +1 {2}2026-11-01_05-30-12_local +this window +2\.0 KB {2}updated now$/);
    assert.match(list[2] ?? '', /^ +2 {2}2026-11-01_05-31-00_local +other app, running/);
    game.run('netlog show run:2 --loss');
    await settle();
    await settle();
    assert.match(asked.at(-1) ?? '', /netread\?run=2026-11-01_05-31-00_local&lines=1000$/);
    const other = printed();
    assert.match(other[0] ?? '', /^Network log 2026-11-01_05-31-00_local: 1 of the last 2 lines match\.$/);
    assert.match(other[1] ?? '', /LOSS +resend #0 CHAT /);
    assert.match((game.run('netlog show run:9'))[0] ?? '', /^error: no run 9/);

    assert.match((game.run('netlog off'))[0] ?? '', /net_log = off/);
    recorder.tick(time += 50);
    assert.match((game.run('netlog'))[0] ?? '', /^Network log: off/);
    game.run('netlog on');
    assert.match((game.run('netlog all'))[0] ?? '', /^net_log_all = off$/);
    assert.match((game.run('netlog all on'))[0] ?? '', /net_log_all = on/);
    assert.match((game.run('netlog'))[0] ?? '', /Everything \(every packet and state update\): on \(net_log_all\)\. State updates: written\.$/);
  } finally {
    G.fetch = realFetch;
    game.run('unset net_log');
    game.run('unset net_log_all');
    network.connections = [];
    recorder.tick(time + 50);
  }
});
