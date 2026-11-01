import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { bootConsole, type FakeGame } from '#console/testing/fake-game.fixture.ts';
import { errorOf } from '#console/testing/console-output.fixture.ts';

let game: FakeGame;
before(async () => { game = await bootConsole(); });

const REFUSED = /^error: refused in a ranked match: .*"bypass checks" turns this protection off \(dangerous\)\.$/;
const inMatch = (context: TestContext, details: Record<string, unknown>) => {
  const net = game.globals[game.names.net];
  net.match_details = details;
  context.after(() => { delete net.match_details; });
};
const RANKED = Object.freeze({ approved: 2, ranked: true, map_id: 'zynther-alaska' });

test('the anti-cheat scan report is logged as the game sends it, once', () => {
  const { globals, names } = game;
  const net = globals[names.net];
  const walls = [0, 300];
  globals[names.wallX] = walls;
  globals[names.lockedArrays].push([], walls);
  const warned: string[] = [];
  const realWarn = console.warn;
  console.warn = (...parts: unknown[]) => { warned.push(parts.join(' ')); };
  try {
    net[names.netLog].push({ type: 'PING', parts: ['PING', '7'], time: 1 });
    net[names.netLog].push({ type: 'PING', parts: ['PING', 'undefined', '3', '1'], time: 2 });
    game.frame(2);
    assert.equal(warned.length, 1, warned.join(' | '));
    assert.match(warned[0] ?? '', /^\[anti-cheat\] scan report sent.*code 3 \(a locked array changed\): locked array 1 of 2 \(wallX\)$/);
    net[names.netLog].push({ type: 'PING', parts: ['PING', 'undefined', '2', '5/old/new'], time: 3 });
    game.frame();
    assert.match(warned[1] ?? '', /code 2 \(a function changed\): 5\/old\/new$/);
  } finally {
    console.warn = realWarn;
    globals[names.lockedArrays].length = 0;
  }
});

test('bypass checks: a red warning, then only the exact phrase typed on its own line turns the protection off', async (context) => {
  const { run } = await import('#console/kernel/dispatch.ts');
  const danger = await import('#console/kernel/danger/bypass.ts');
  inMatch(context, RANKED);
  context.after(() => { danger.protectAgain(); game.run('reset'); game.frame(); });
  assert.match(game.run('bypass')[0] ?? '', /^Protection: on\. In approved, ranked matches \(you are in one now\)/);

  const warning = game.run('bypass checks');
  assert.match(warning[0] ?? '', /^WARNING: DANGEROUS\./);
  assert.ok(warning.includes('To go ahead, type exactly: ALLOW DANGEROUS COMMANDS'), warning.join('\n'));
  const NO = 'Not turned off: that was not the phrase. The protection stays on, and the line was not run.';
  assert.deepEqual(game.run('allow dangerous commands'), [NO]);
  assert.match(errorOf(game.run('max_hp 500')), REFUSED);
  game.run('bypass checks');
  assert.deepEqual(game.run('list'), [NO], 'a command is not run either');
  assert.equal(danger.checksBypassed(), false);

  game.log.printed.length = 0;
  run('bypass checks', 'bind f5');
  assert.match(game.log.printed.join('\n'), /error: type "bypass checks" yourself, on a line of its own/);
  assert.match(errorOf(game.run('bypass checks; list')), /error: type "bypass checks" yourself/);
  game.run('bypass checks');
  run('ALLOW DANGEROUS COMMANDS', 'bind f5');
  assert.equal(danger.checksBypassed(), false, 'a bind cannot answer');
  assert.match(game.run('ALLOW DANGEROUS COMMANDS')[0] ?? '', /^Protection OFF/);
  assert.equal(danger.checksBypassed(), true);

  assert.ok(game.run('max_hp 500').includes('max_hp = 500'));
  game.frame();
  assert.equal(game.player.hmax, 500, 'applied in the ranked match now');
  assert.match(game.run('bypass')[0] ?? '', /^Protection: OFF/);
  assert.ok(game.run('list').some((line) => /ranked match protection: OFF/.test(line)));
  assert.match(game.run('bypass off')[0] ?? '', /^Protection on again/);
  game.frame();
  assert.notEqual(game.player.hmax, 500, 'held back again');
});
