import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '../../../test/fake-game.mjs';

test('"js" evaluates in the page and prints the last value; "js help" is the guide', async () => {
  const game = await bootConsole();
  assert.deepEqual(game.run('js 1 + 2'), ['3']);
  assert.deepEqual(game.run('js let n = 0; for (let i = 0; i < 3; i++) n += i; n'), ['3']);
  const guide = game.run('js help');
  assert.match(guide[0] ?? '', /^js <code> runs JavaScript inside the game page/);
  assert.ok(guide.some((line) => /js PB2_NAMES\.chars/.test(line)));
  assert.match(game.run('js nope.nope')[0] ?? '', /^error: .*nope/);
});
