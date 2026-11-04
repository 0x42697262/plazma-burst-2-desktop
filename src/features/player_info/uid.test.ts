import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';
import { characterUids } from './capabilities/uid/uids.ts';

test('characterUids: the uids of the map\'s players and enemies, in map order, null where there is none', () => {
  assert.deepEqual(characterUids('<box x="0" /><player uid="#a" x="1" />\n<enemy x="2" /><region uid="#r" /><enemy uid="#e*2" />'), ['#a', null, '#e*2']);
});

test('uid: a character\'s map uid by #, name or none (yours), or everyone\'s', async () => {
  const game = await bootConsole();
  const { globals, names } = game;
  const original = globals[names.mapText];
  try {
    assert.deepEqual(game.run('uid'), ['#0 you: #player*0']);
    assert.deepEqual(game.run('uid 1'), ['#1 bob: #player*1']);
    assert.deepEqual(game.run('uid blue'), ['#2 bluebot: #player*2'], 'part of a nickname, as tp takes it');
    assert.deepEqual(game.run('puid bob'), ['#1 bob: #player*1']);
    assert.match(errorsOf(game.run('uid 7'))[0], /no character #7/);
    globals[names.mapText] = '<player uid="#hero" x="0" y="0" />\n<enemy x="5" y="0" />';
    assert.deepEqual(game.run('uid all'), [
      '#0 you: #hero',
      '#1 bob: no uid in this map (a map without uids names it by its number, 1)',
      '#2 bluebot: not one of the map\'s 2 players and enemies',
    ]);
  } finally {
    globals[names.mapText] = original;
  }
});
