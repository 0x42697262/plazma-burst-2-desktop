import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('zoom: any amount once, or locked so the map cannot change it', async () => {
  const game = await bootConsole();
  const { G, N } = game;
  const run = (line: string) => game.run(line).filter((printed) => !printed.startsWith('Note:'));
  const was: unknown = G[N.zoom];
  G[N.zoom] = 1;
  try {
    assert.deepEqual(run('zoom 35'), ['Zoom 35%']);
    assert.equal(G[N.zoom], 0.35);
    G[N.zoom] = 2;
    game.frame();
    assert.equal(G[N.zoom], 2, 'not held without --lock');
    assert.match(run('zoom 50 --lock')[0] ?? '', /^Zoom 50%, locked/);
    G[N.zoom] = 0.75;
    game.frame();
    assert.equal(G[N.zoom], 0.5, 'put back');
    assert.deepEqual(run('zoom'), ['Zoom: 50%, locked at 50%']);
    assert.deepEqual(game.run('list zoom'), ['[zoom]', '  locked at 50%  ("zoom --unlock" lets go)']);
    assert.deepEqual(run('zoom 80'), ['Zoom 80% (unlocked)']);
    assert.deepEqual(game.run('list zoom'), ['[zoom]', '  80%  (once: the map can change it)']);
    G[N.zoom] = 1;
    game.frame();
    assert.equal(G[N.zoom], 1);
    run('zoom 60 --lock');
    assert.match(run('zoom --unlock')[0] ?? '', /^Zoom unlocked/);
    G[N.zoom] = 1;
    game.frame();
    assert.equal(G[N.zoom], 1);
    assert.deepEqual(run('zoom default'), ['Zoom 100%']);
    assert.deepEqual(game.run('list zoom'), ['[zoom] nothing']);
    for (const bad of ['zoom 0', 'zoom 2000', 'zoom abc', 'zoom --lock', 'zoom 50 --lock --unlock']) {
      assert.match(run(bad).join(' '), /usage|do not go together/, bad);
    }
  } finally {
    run('zoom --unlock');
    G[N.zoom] = was;
  }
});
