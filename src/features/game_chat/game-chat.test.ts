import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('"game help" lists the built-in commands by group; outside a level a command is refused', async () => {
  const game = await bootConsole();
  const help = game.run('game help');
  assert.equal(help[0], 'Built-in game commands (run with: game <command>):');
  assert.ok(help.includes('[Cheats]') && help.includes('[Game speed]'));
  assert.ok(help.some((line) => /^ {2}kill enemies +Kill every character not on your team$/.test(line)));
  assert.match(help.at(-1) ?? '', /builtin is (on|off)/);
  assert.deepEqual(game.run('game').filter((line) => !line.startsWith('Note:')), help, 'alone it is the help too');
  game.G.stage.currentFrameLabel = 'menu';
  assert.ok(game.run('game god').some((line) => line.startsWith('error: ')));
});
