import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { fakeConnection } from '#console/testing/net-protocol.fixture.ts';

test('on a private server nothing is captured: its code could otherwise be run later by "fingerprint"', async () => {
  Object.defineProperty(globalThis, 'PB2_JOIN', { value: Object.freeze({ address: '1.2.3.4:2053', nickname: 'Pal', password: 'pw' }) });
  Reflect.set(globalThis, 'loaderInfo', { parameters: { l: '', p: '' } });
  const game = await bootConsole();
  const { fingerprintCapture } = await import('./console.ts');
  const network = game.G[game.N.net] as Record<string, unknown>;
  const conn = fakeConnection(game.N);
  network[game.N.lobbyConn] = conn;
  network[game.N.lobbyHosts] = [''];
  fingerprintCapture.tick();
  assert.ok(!Object.hasOwn(conn, game.N.connRecv), 'the private lobby is not listened to');
});
