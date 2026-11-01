import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('when the guard cannot start (a name is missing), the game does not join the private server, and the player is told', async () => {
  Object.defineProperty(globalThis, 'PB2_JOIN', { value: Object.freeze({ address: '1.2.3.4:2053', nickname: 'Pal', password: 'pw' }) });
  Reflect.set(globalThis, 'loaderInfo', { parameters: { l: '', p: '' } });
  const alerts: unknown[] = [];
  Reflect.set(globalThis, 'alert', (message: unknown) => { alerts.push(message); });
  const realError = console.error;
  console.error = () => undefined;
  try {
    const game = await bootConsole({ entry: null });
    const network = game.globals[game.names.net] as Record<string, unknown>;
    network[game.names.lobbyHosts] = ['', 'https://vvvv.', 'https://www.'];
    assert.equal(game.intervals.length, 0, 'no join client runs');
    assert.deepEqual(network[game.names.lobbyHosts], ['', 'https://vvvv.', 'https://www.'], 'the lobby addresses still point at the official site');
    assert.match(String(alerts[0]), /connection class was not found .*The game does not join it/);
  } finally {
    console.error = realError;
  }
});
