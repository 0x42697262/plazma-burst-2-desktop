import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { parseFpsWords } from './domain/words.ts';

test('fps words: each sets one part, in any order, at most once', () => {
  assert.deepEqual(parseFpsWords(['60', 'high']), { fps: 60, physics: 'high' });
  assert.deepEqual(parseFpsWords(['HIGH', '60', 'unlimited']), { fps: 60, physics: 'high', logic: 'unlimited' });
  assert.deepEqual(parseFpsWords(['low']), { physics: 'low' });
  assert.deepEqual(parseFpsWords([]), {});
  assert.throws(() => parseFpsWords(['45']), /usage: fps/);
  assert.throws(() => parseFpsWords(['60', '30']), /usage: fps/);
  assert.throws(() => parseFpsWords(['low', 'high']), /usage: fps/);
});

test('fps sets the game\'s own settings the way its Esc menu does, and shows them', async () => {
  const booted = await bootConsole();
  const { G, N } = booted;
  const game = { run: (line: string) => booted.run(line).filter((printed) => !printed.startsWith('Note:')) };
  const calls: string[] = [];
  G[N.fpsChoice] = 1;
  G[N.lowPhysics] = true;
  G[N.applyFps] = () => { calls.push(`apply ${String(G[N.fpsChoice])}`); };
  G[N.syncPointHistory] = () => { calls.push('sync'); };
  Reflect.set(globalThis, 'UNLIMITED_SCREEN_REFRESH_RATE', false);
  try {
    assert.deepEqual(game.run('fps'), ['FPS 20, physics low, logic match']);
    assert.deepEqual(game.run('fps 60 high'), ['FPS 60, physics high, logic match']);
    assert.equal(G[N.fpsChoice], 3);
    assert.equal(G[N.lowPhysics], false);
    assert.deepEqual(calls, ['apply 3', 'sync']);
    calls.length = 0;
    assert.deepEqual(game.run('fps unlimited'), ['FPS 60, physics high, logic unlimited']);
    assert.deepEqual(calls, [], 'only the logic changed');
    assert.equal(Reflect.get(globalThis, 'UNLIMITED_SCREEN_REFRESH_RATE'), true);
    assert.match(game.run('fps 45')[0] ?? '', /usage: fps/);
  } finally {
    Reflect.deleteProperty(globalThis, 'UNLIMITED_SCREEN_REFRESH_RATE');
  }
});

test('a client without the logic setting says so and still sets the rest', async () => {
  const booted = await bootConsole();
  const { G, N } = booted;
  const game = { run: (line: string) => booted.run(line).filter((printed) => !printed.startsWith('Note:')) };
  G[N.fpsChoice] = 2;
  G[N.lowPhysics] = false;
  G[N.applyFps] = () => undefined;
  G[N.syncPointHistory] = () => undefined;
  const printed = game.run('fps 20 unlimited');
  assert.match(printed[0] ?? '', /logic is not in this game client/);
  assert.equal(G[N.fpsChoice], 1);
  assert.equal(printed.at(-1), 'FPS 20, physics high, logic ?');
});
