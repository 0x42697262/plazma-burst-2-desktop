import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bootConsole, CONSOLE_ENTRY } from '../../../test/fake-game.mjs';

const consoleModule = (relative) => import(pathToFileURL(path.join(path.dirname(CONSOLE_ENTRY), relative)).href);
const errorsOf = (out) => out.filter((line) => line.startsWith('error: '));

let game;
before(async () => { game = await bootConsole(); });

const REFUSED = /^error: refused in a ranked match: .*"bypass checks" turns this protection off \(dangerous\)\.$/;
const errorOf = (out) => out.find((line) => line.startsWith('error: ')) || out.join(' | ');
const inMatch = (context, details) => {
  const net = game.G[game.N.net];
  net.match_details = details;
  context.after(() => { delete net.match_details; });
};
const RANKED = Object.freeze({ approved: 2, ranked: true, map_id: 'zynther-alaska' });

test('the anti-cheat scan report is logged as the game sends it, once', () => {
  const { G, N } = game;
  const net = G[N.net];
  const walls = [0, 300];
  G[N.wallX] = walls;
  G[N.lockedArrays].push([], walls);
  const warned = [];
  const realWarn = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    // The game's own ping (2 parts), then the scan's report for locked array 1.
    net[N.netLog].push({ type: 'PING', parts: ['PING', '7'], time: 1 });
    net[N.netLog].push({ type: 'PING', parts: ['PING', 'undefined', '3', '1'], time: 2 });
    game.frame(2);
    assert.equal(warned.length, 1, warned.join(' | '));
    assert.match(warned[0], /^\[anti-cheat\] scan report sent.*code 3 \(a locked array changed\): locked array 1 of 2 \(wallX\)$/);
    net[N.netLog].push({ type: 'PING', parts: ['PING', 'undefined', '2', '5/old/new'], time: 3 });
    game.frame();
    assert.match(warned[1], /code 2 \(a function changed\): 5\/old\/new$/);
  } finally {
    console.warn = realWarn;
    G[N.lockedArrays].length = 0;
  }
});

test('bypass checks: a red warning, then only the exact phrase typed on its own line turns the protection off', async (t) => {
  const { run } = await consoleModule('dispatch.js');
  const danger = await consoleModule('state/danger.js');
  inMatch(t, RANKED);
  t.after(() => { danger.protectAgain(); game.run('reset'); game.frame(); });
  assert.match(game.run('bypass')[0], /^Protection: on\. In approved, ranked matches \(you are in one now\)/);

  const warning = game.run('bypass checks');
  assert.match(warning[0], /^WARNING: DANGEROUS\./);
  assert.ok(warning.includes('To go ahead, type exactly: ALLOW DANGEROUS COMMANDS'), warning.join('\n'));
  const NO = 'Not turned off: that was not the phrase. The protection stays on, and the line was not run.';
  // Anything else turns it down and is not run, wrong capitals included.
  assert.deepEqual(game.run('allow dangerous commands'), [NO]);
  assert.match(errorOf(game.run('max_hp 500')), REFUSED);
  game.run('bypass checks');
  assert.deepEqual(game.run('list'), [NO], 'a command is not run either');
  assert.equal(danger.checksBypassed(), false);

  // Not from a bind, a profile or a chain.
  game.log.printed.length = 0;
  run('bypass checks', 'bind f5');
  assert.match(game.log.printed.join('\n'), /error: type "bypass checks" yourself, on a line of its own/);
  assert.match(errorOf(game.run('bypass checks; list')), /error: type "bypass checks" yourself/);
  // A bind pressed while it waits runs as usual, and is not the answer.
  game.run('bypass checks');
  run('ALLOW DANGEROUS COMMANDS', 'bind f5');
  assert.equal(danger.checksBypassed(), false, 'a bind cannot answer');
  assert.match(game.run('ALLOW DANGEROUS COMMANDS')[0], /^Protection OFF/);
  assert.equal(danger.checksBypassed(), true);

  assert.ok(game.run('max_hp 500').includes('max_hp = 500'));
  game.frame();
  assert.equal(game.player.hmax, 500, 'applied in the ranked match now');
  assert.match(game.run('bypass')[0], /^Protection: OFF/);
  assert.ok(game.run('list').some((l) => /ranked match protection: OFF/.test(l)));
  assert.match(game.run('bypass off')[0], /^Protection on again/);
  game.frame();
  assert.notEqual(game.player.hmax, 500, 'held back again');
});
