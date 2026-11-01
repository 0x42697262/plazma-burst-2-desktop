import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bootConsole, CONSOLE_ENTRY, LEGACY_CONSOLE_DIR } from '../../../test/fake-game.mjs';

const consoleModule = (relative) => import(pathToFileURL(path.join(LEGACY_CONSOLE_DIR, relative)).href);
const errorsOf = (out) => out.filter((line) => line.startsWith('error: '));

let game;
before(async () => { game = await bootConsole(); });

test('trace draws a white line from you to each traced character', async () => {
  const overlay = await consoleModule('../../../src/console/kernel/ui/overlay.ts');
  const cam = game.G.game;
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  // You at (0, 0), bob (#1) at (100, -50), bluebot (#2) at (600, 100). Set here: earlier
  // tests teleport you around.
  const place = [[0, 0], [100, -50], [600, 100]];
  place.forEach(([x, y], i) => { game.chars[i].x = x; game.chars[i].y = y; });
  const frame = () => { game.log.drawn.length = 0; return overlay.drawOverlay(); };
  const texts = () => game.log.drawn.filter((d) => d[0] === 'fillText').map((d) => d[1]);

  assert.match(game.run('trace')[0], /Not tracing anyone/);
  assert.match(game.run('trace 1')[0], /^Tracing slot #1 bob \(112px\)/);
  assert.equal(frame().trace.lines, 1);
  // Middles are 41 above the feet: you (0, -41) -> screen (100, 9); bob -> (200, -41).
  assert.ok(game.log.drawn.some((d) => d[0] === 'moveTo' && d[1] === 100 && d[2] === 9), 'from your middle');
  assert.ok(game.log.drawn.some((d) => d[0] === 'lineTo' && d[1] === 200 && d[2] === -41), 'to bob\'s middle');
  assert.ok(texts().includes('#1 bob 112px'), 'name and distance');

  game.run('trace --all');
  assert.equal(frame().trace.lines, 2, 'everyone but you');
  game.run('trace --off 2');
  frame();
  assert.deepEqual(texts(), ['#1 bob 112px'], 'from "all", the others stay');
  assert.match(errorsOf(game.run('trace 0'))[0], /that is you/);
  assert.match(errorsOf(game.run('trace nobody'))[0], /no character named "nobody"/);

  // Off screen: bluebot far right, its label where the line leaves the screen.
  game.run('trace 2');
  const bot = game.chars[2];
  bot.x = 5000;
  frame();
  const plate = game.log.drawn.filter((d) => d[0] === 'fillRect').map((d) => ({ x: d[1], w: d[3] }));
  assert.ok(plate.every((r) => r.x >= 0 && r.x + r.w <= 800), 'every label inside the screen');
  assert.ok(texts().some((t) => t.startsWith('#2 bluebot 5001px')), 'distance from (0, 0) to (5000, 100)');
  bot.x = 600;

  bot.hea = 0;
  frame();
  assert.ok(texts().some((t) => t.endsWith('(down)')), 'a downed character is marked');
  bot.hea = 100;

  game.run('logic show');
  const both = frame();
  assert.ok(both.logic && both.trace, 'logic and traces in one frame');
  game.run('logic hide');
  assert.ok(frame().trace, 'hiding logic keeps the traces');
  game.run('trace --off');
  assert.equal(game.log.frames.length, 0, 'the overlay goes with its last layer');
});

test('trace --players skips bots, and a word that is not an option is a name', () => {
  const traced = () => game.run('trace').slice(1).map((l) => l.trim().split(/\s+/).slice(0, 2).join(' '));
  game.run('trace --off');
  assert.match(game.run('trace --players')[0], /^Tracing every other player: 1 character now/);
  assert.deepEqual(traced(), ['#1 bob'], 'bluebot is a bot');
  game.chars[2][game.N.charHuman] = true; // a player in that slot now
  assert.deepEqual(traced(), ['#1 bob', '#2 bluebot'], 'who joins later is traced too');
  game.chars[2][game.N.charHuman] = false;
  game.run('trace --players bluebot');
  assert.deepEqual(traced(), ['#1 bob', '#2 bluebot'], 'a bot on top of the players');
  game.run('trace --off 1');
  assert.deepEqual(traced(), ['#2 bluebot'], 'one left out, the group stays');
  assert.match(game.run('trace')[0], /\(every other player, also who joins later\)/);
  game.run('trace --off');

  // Old keywords are names now; a miss says what was meant.
  assert.match(errorsOf(game.run('trace all'))[0], /no character named "all"\. For the option, type "trace --all"/);
  assert.match(errorsOf(game.run('tp off'))[0], /no character named "off"\. For the old hotkey syntax, type "tp --off"/);
  const bob = game.chars[1];
  bob.nickname = 'all';
  assert.match(game.run('trace all')[0], /^Tracing #1 all/, 'a player named "all"');
  game.run('trace --off');
  bob.nickname = '--odd--';
  assert.match(errorsOf(game.run('trace --odd--'))[0], /unknown option "--odd--"\. Options: --all, --players, --npc, --team, --enemies, --off\. "-- --odd--" if it is a name/);
  assert.match(game.run('trace -- --odd--')[0], /^Tracing #1 --odd--/);
  game.run('trace --off');
  bob.nickname = '1 2';
  assert.match(game.run('tp -- 1 2').at(-1), /^Teleported to #1 1 2 at/, 'after "--" two numbers are a name');
  bob.nickname = 'bob';
  for (const help of ['trace --help', 'tp -h', 'revive --help']) {
    assert.deepEqual(game.run(help), game.run(`help ${help.split(' ')[0]}`), help);
  }
});

test('trace filters: a kind and a side combine, and what cannot go together says so', () => {
  // You and bob (#1, a player) are team 0; bluebot (#2, an NPC) is team 13.
  const traced = () => game.run('trace').slice(1).map((l) => l.trim().split(/\s+/).slice(0, 2).join(' '));
  const bot = game.chars[2];
  game.run('trace --off');
  assert.match(game.run('trace --enemies')[0], /^Tracing everyone on the other teams: 1 character now/);
  assert.deepEqual(traced(), ['#2 bluebot']);
  game.run('trace --team');
  assert.deepEqual(traced(), ['#1 bob'], 'a new group replaces the old one');
  assert.deepEqual(game.run('trace --all --team'), game.run('trace --team'), '--all with a filter changes nothing');
  game.run('trace --npc');
  assert.deepEqual(traced(), ['#2 bluebot']);
  assert.match(game.run('trace --players --enemies')[0], /^Tracing every other player on the other teams: 0 characters now/);
  assert.match(game.run('trace')[0], /^Tracing every other player on the other teams, but nobody is here yet/);
  assert.ok(game.run('list trace').includes('[trace: 0 (--players --enemies)]'));
  game.run('trace --npc --team');
  assert.deepEqual(traced(), [], 'bluebot is not on your team');
  bot.team = 0;
  assert.deepEqual(traced(), ['#2 bluebot'], 'teams are checked as they are now');
  bot.team = 13;
  game.run('trace --npc --team 1');
  assert.deepEqual(traced(), ['#1 bob'], 'a name on top of a group that has nobody');

  for (const [line, err] of [
    ['trace --players --npc', /--players and --npc do not go together/],
    ['trace --team --enemies', /--team and --enemies do not go together/],
    ['trace --off --enemies', /--off and --enemies do not go together/],
    ['trace --off --all', /--off and --all do not go together/],
    ['trace --enemy', /unknown option "--enemy"/],
  ]) {
    const before = traced();
    assert.match(errorsOf(game.run(line))[0] || '', err, line);
    assert.deepEqual(traced(), before, `${line} changes nothing`);
  }
  assert.match(errorsOf(game.run('trace enemies'))[0], /For the option, type "trace --enemies"/);
  game.run('trace --off');
});

test('trace by name follows the player until they leave; by # follows the slot', async () => {
  const traced = () => game.run('trace').slice(1).map((l) => l.trim().split(/\s+/).slice(0, 2).join(' '));
  const bob = game.chars[1];
  // A player leaves: the game switches the slot off. Another joins: the same character,
  // with their account and nickname.
  const leave = (ch) => { ch.io = false; };
  const join = (ch, login, nick) => { Object.assign(ch, { io: true, login, nickname: nick }); };
  const settle = () => new Promise((r) => queueMicrotask(r));
  game.run('trace --off');
  join(bob, 'bob_account', 'bob');

  game.run('trace bob');
  assert.deepEqual(traced(), ['#1 bob']);
  leave(bob);
  assert.deepEqual(traced(), [], 'bob left');
  await settle();
  assert.equal(game.log.frames.length, 0, 'nothing left to draw: the overlay goes');
  join(bob, 'eve_account', 'eve');
  assert.deepEqual(traced(), [], 'eve in bob\'s slot is not bob');
  join(bob, 'bob_account', 'bob');
  assert.deepEqual(traced(), [], 'leaving ended it, even when bob comes back');

  game.run('trace 1');
  join(bob, 'eve_account', 'eve');
  assert.deepEqual(traced(), ['#1 eve'], 'a slot, whoever is in it');
  assert.ok(game.run('trace').some((l) => /#1 eve\s+\d+px\s+slot: whoever is in it/.test(l)));
  leave(bob);
  assert.deepEqual(traced(), []);
  join(bob, 'bob_account', 'bob');
  assert.deepEqual(traced(), ['#1 bob'], 'the slot stays traced while it is empty');
  game.run('trace --off');

  // Dropped from a group the same way: by name the person, by # the slot.
  game.run('trace --all; trace --off bob');
  assert.deepEqual(traced(), ['#2 bluebot']);
  join(bob, 'eve_account', 'eve');
  assert.deepEqual(traced(), ['#1 eve', '#2 bluebot'], 'eve was never dropped');
  game.run('trace --off 1');
  join(bob, 'bob_account', 'bob');
  assert.deepEqual(traced(), ['#2 bluebot'], 'the slot stays dropped');
  game.run('trace --off');
  delete bob.login;
});
