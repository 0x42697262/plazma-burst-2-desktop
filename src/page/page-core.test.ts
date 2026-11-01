import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { NET_DIGITS, encNum, netMsg, netPacket } from '#console/testing/net-protocol.fixture.ts';
import { splitParts, unescField } from '#console/kernel/net/codec.ts';

test('without the dev console, the page core still keeps a private lobby\'s code from running and still joins the server', async () => {
  Object.defineProperty(globalThis, 'PB2_JOIN', { value: Object.freeze({ address: '1.2.3.4:2053', nickname: 'Pal', password: 'pw' }) });
  Reflect.set(globalThis, 'loaderInfo', { parameters: { l: '', p: '' } });
  const receiveName = '__pb2_connRecv';
  class Connection {
    got: string[] = [];
    [receiveName](text: string) { this.got.push(text); }
  }
  Reflect.set(globalThis, '__pb2_connClass', Connection);
  const warned: string[] = [];
  const realWarn = console.warn;
  console.warn = (...parts: unknown[]) => { warned.push(parts.join(' ')); };
  try {
    const game = await bootConsole({ entry: null });
    assert.equal(Reflect.get(globalThis, 'pb2dev'), undefined, 'no console in this page');
    const network = game.globals[game.names.net] as Record<string, unknown>;
    network[game.names.netDigits] = NET_DIGITS;
    network[game.names.netTypeNames] = { 5: 'RELIABLE_CHAT', 46: 'RELIABLE_TASK' };
    network[game.names.lobbyHosts] = ['', 'https://vvvv.', 'https://www.'];

    const connection = new Connection() as Connection & Record<string, (text: string) => void>;
    connection[receiveName]?.(netPacket(0, '', [[0, netMsg(46, 'globalThis.pwned = true', encNum(110))]]));
    const fields = (connection.got[0] ?? '').split('\x01');
    assert.deepEqual(splitParts(unescField(fields[3] ?? '')), [encNum(46), '()=>undefined', encNum(110)]);
    assert.equal(Reflect.get(globalThis, 'pwned'), undefined);
    assert.ok(warned.some((line) => /^\[pb2\] This private server sent code for the game to run \(a task\)\. It was not run/.test(line)), warned.join('\n'));

    const joinTick = game.intervals[0];
    assert.ok(joinTick, 'the join client runs without the console');
    game.globals.stage.currentFrameLabel = 'menu';
    joinTick();
    assert.deepEqual(network[game.names.lobbyHosts], ['https://1.2.3.4:2053/?', 'https://1.2.3.4:2053/?', 'https://1.2.3.4:2053/?']);
  } finally {
    console.warn = realWarn;
  }
});
