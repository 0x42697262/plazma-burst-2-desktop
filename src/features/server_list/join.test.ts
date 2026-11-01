import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('join mode: the lobby address points at the server, the login is set from the menu on, Tab shows the server', async () => {
  Object.defineProperty(globalThis, 'PB2_JOIN', { value: Object.freeze({ address: '1.2.3.4:2053', nickname: 'Pal', password: 'pw' }) });
  const loaderInfo = { parameters: { l: '', p: '' } };
  Reflect.set(globalThis, 'loaderInfo', loaderInfo);
  const game = await bootConsole();
  const network = game.G[game.N.net] as Record<string, unknown>;
  network[game.N.lobbyHosts] = ['', 'https://vvvv.', 'https://www.'];
  const tick = game.intervals[game.intervals.length - 1];
  assert.ok(tick);
  game.G.stage.currentFrameLabel = 'loading';
  tick();
  const before = { ...loaderInfo.parameters };
  game.G.stage.currentFrameLabel = 'menu';
  game.G[game.N.serverLocation] = 'USA, Arizona';
  tick();
  const location: unknown = game.G[game.N.serverLocation];
  game.G[game.N.serverLocation] = 'Europe, player-hosted';
  tick();
  assert.deepEqual(network[game.N.lobbyHosts], ['https://1.2.3.4:2053/?', 'https://1.2.3.4:2053/?', 'https://1.2.3.4:2053/?']);
  assert.deepEqual(before, { l: '', p: '' }, 'nothing during start-up, when the game talks to the official site');
  assert.deepEqual(loaderInfo.parameters, { l: 'Pal', p: 'pw' });
  assert.equal(location, 'Private server, 1.2.3.4:2053', 'the Tab scoreboard names the server, not "USA, Arizona"');
  assert.equal(game.G[game.N.serverLocation], 'Europe, player-hosted', 'a player-hosted match keeps its region');
  assert.ok(game.log.printed.some((line) => /Multiplayer connects there, as Pal/.test(line)), game.log.printed.join('\n'));
});
