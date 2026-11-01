import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { NET_DIGITS, encNum, netMsg, netPacket } from '#console/testing/net-protocol.fixture.ts';
import { splitParts, unescField } from '#console/kernel/net/codec.ts';

test('on a private server, a task the lobby sends in its very first packet reaches the game only as code that does nothing', async () => {
  Object.defineProperty(globalThis, 'PB2_JOIN', { value: Object.freeze({ address: '1.2.3.4:2053', nickname: 'Pal', password: 'pw' }) });
  Reflect.set(globalThis, 'loaderInfo', { parameters: { l: '', p: '' } });
  const receiveName = '__pb2_connRecv';
  class Connection {
    got: string[] = [];
    [receiveName](text: string) { this.got.push(text); }
  }
  Reflect.set(globalThis, '__pb2_connClass', Connection);
  const game = await bootConsole();
  const network = game.G[game.N.net] as Record<string, unknown>;
  network[game.N.netDigits] = NET_DIGITS;
  network[game.N.netTypeNames] = { 5: 'RELIABLE_CHAT', 46: 'RELIABLE_TASK' };
  network[game.N.lobbyHosts] = [''];
  const connection = new Connection() as Connection & Record<string, (text: string) => void>;
  connection[receiveName]?.(netPacket(0, '', [[0, netMsg(46, 'globalThis.pwned = true', encNum(110))], [1, netMsg(5, 'welcome')]]));
  const received = connection.got[0] ?? '';
  const fields = received.split('\x01');
  assert.deepEqual(splitParts(unescField(fields[3] ?? '')), [encNum(46), '()=>undefined', encNum(110)]);
  assert.deepEqual(splitParts(unescField(fields[5] ?? '')), [encNum(5), 'welcome']);
  assert.ok(game.log.printed.some((line) => /sent code for the game to run \(a task\)\. It was not run/.test(line)), game.log.printed.join('\n'));
  assert.equal(Reflect.get(globalThis, 'pwned'), undefined);
  assert.ok(Object.hasOwn(Connection.prototype, receiveName), 'the guard sits on the class, before any connection exists');
});
