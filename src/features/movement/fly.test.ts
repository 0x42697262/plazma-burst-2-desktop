import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole, type FakeGame } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const CLOSE = 1e-9;
const GRAVITY = 0.5;
const KNOCKED = 0.3;

let game: FakeGame;
before(async () => { game = await bootConsole(); });
beforeEach(() => {
  game.run('unset fly; unset fly_accel_x; unset fly_accel_y; unset fly_drag; unset fly_lift; unset fly_upright; unset fly_speed');
  Object.assign(game.player, { tox: 0, toy: 0, stand: false, [game.names.moveIntentX]: 0, [game.names.moveIntentY]: 0, [game.names.stability]: 1 });
  game.globals[game.names.keyUp] = false;
  game.globals[game.names.keyDown] = false;
});

const near = (actual: number, expected: number, message: string): void => { assert.ok(Math.abs(actual - expected) < CLOSE, `${message}: ${actual} != ${expected}`); };

test('"fly free" pushes you along the movement keys, cancels most of gravity and slows you down each frame', () => {
  assert.ok(game.run('fly free').includes('fly = free'));
  game.player[game.names.moveIntentX] = 1;
  game.player[game.names.moveIntentY] = -1;
  game.frame();
  near(game.player.tox, 1 * 0.98 ** 2, 'right: push 1, then 98% kept twice (one tick is two frames at 60 fps)');
  near(game.player.toy, (-GRAVITY * 0.98 - 0.8) * 0.98 ** 2, 'up: gravity canceled by 98% and push 0.8, then 98% kept twice');
});

test('the free-flight settings change the push, the drag and the lift', () => {
  game.run('fly free; fly_accel_x 2; fly_drag 1; fly_lift 1');
  game.player[game.names.moveIntentX] = -1;
  game.frame();
  near(game.player.tox, -2, 'left at 2, nothing lost to drag');
  near(game.player.toy, -GRAVITY, 'gravity fully canceled');
});

test('"fly free" keeps you upright unless fly_upright is off', () => {
  game.run('fly free');
  game.player[game.names.stability] = KNOCKED;
  game.frame();
  assert.equal(game.player[game.names.stability], 1);
  game.run('fly_upright off');
  game.player[game.names.stability] = KNOCKED;
  game.frame();
  assert.equal(game.player[game.names.stability], KNOCKED);
});

test('"fly on" still moves you straight up and down with the jump and crouch keys', () => {
  game.run('fly on');
  game.player[game.names.moveIntentX] = 1;
  game.globals[game.names.keyUp] = true;
  game.frame();
  assert.equal(game.player.toy, -6, 'up at fly_speed');
  assert.equal(game.player.tox, 0, 'no sideways push');
});

test('fly takes on, off or free; typing "fly" alone turns free flight off', () => {
  assert.match(errorsOf(game.run('fly sideways'))[0] ?? '', /fly expects on\/off\/free/);
  game.run('fly free');
  game.run('fly');
  assert.ok(game.run('get fly').includes('fly = off'));
});

test('"help fly" names every mode, the sweep options and the settings', () => {
  const help = game.run('help fly').join('\n');
  assert.match(help, /on \| off \| free \| sweep/);
  assert.match(help, /--on \| --off \| --toggle/);
  assert.match(help, /fly_sweep_range/);
  assert.match(help, /fly_speed/);
  assert.match(help, /fly_accel_x, fly_accel_y, fly_drag, fly_lift, fly_upright/);
});

test('"fly" is still the key: on, free, off and plain "fly" behave as before', () => {
  assert.ok(game.run('fly free').includes('fly = free'));
  assert.ok(game.run('fly off').includes('fly = off'));
  assert.ok(game.run('fly').includes('fly = on'));
  assert.ok(game.run('fly sweep').includes('fly = sweep'));
});

test('"fly sweep --on" overrides your aim x left and right of you every tick; the mouse, cursor and camera are left alone', () => {
  game.run('fly_sweep_throttle near');
  const { globals, names, player } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  globals.game.x = 25;
  globals.mouseX = 300;
  globals.mouseY = 150;
  player.x = 100;
  player.tarx = 333;
  game.run('fly_sweep_range 500');
  assert.ok(game.run('fly sweep --on').some((line) => line.startsWith('Sweeping 500')));
  const aims: number[] = [];
  for (let frame = 0; frame < 2; frame++) {
    game.frame();
    player.tarx = 333;
    aims.push(player.tarx);
  }
  assert.deepEqual(aims.sort((left, right) => left - right), [-400, 600], 'one tick each side of x=100, whatever the game wrote');
  player.x = 200;
  assert.ok([-300, 700].includes(player.tarx), 'it follows you as you move within the tick');
  assert.deepEqual([globals.mouseX, globals.mouseY, globals.game.x], [300, 150, 25], 'mouse and camera untouched');
  globals[names.lowPhysics] = true;
  game.frame();
  assert.equal(player.tarx, 333, 'low physics: the game\'s own aim is back');
  globals[names.lowPhysics] = false;
  game.frame();
  assert.ok(game.run('fly sweep --off').includes('Sweep stopped'));
  assert.equal(player.tarx, 333, 'stopped: the game\'s own aim is back');
  player.tarx = 12;
  assert.equal(player.tarx, 12, 'and it is a plain value again');
  assert.ok(game.run('fly sweep --toggle').some((line) => line.startsWith('Sweeping')));
  game.frame();
  game.run('fly off');
  game.frame();
  player.tarx = 13;
  assert.equal(player.tarx, 13, 'another fly mode stops it');
  assert.match(errorsOf(game.run('fly free --on')).join('\n'), /usage: fly/);
  game.run('unset fly_sweep_range');
});

test('"fly sweep" holds ragdoll (X) while sweeping; "fly sword" also holds the mouse button; both let go when stopped', () => {
  const { globals, names, player } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  globals[names.ragdollKey] = false;
  globals[names.mouseHeld] = false;
  player.x = 100;
  game.run('fly sweep --on');
  game.frame();
  assert.deepEqual([globals[names.ragdollKey], globals[names.mouseHeld]], [true, false], 'sweep: X held, no click');
  game.run('fly sweep --off');
  assert.deepEqual([globals[names.ragdollKey], globals[names.mouseHeld]], [false, false], 'stopped: X let go');
  assert.ok(game.run('fly sword --on').some((line) => line.startsWith('Sweeping')));
  assert.ok(game.run('get fly').includes('fly = sword'));
  game.frame();
  assert.deepEqual([globals[names.ragdollKey], globals[names.mouseHeld]], [true, true], 'sword: X and click held');
  player.tarx = 0;
  assert.notEqual(player.tarx, 0, 'sword sweeps too');
  globals[names.mouseHeld] = false;
  game.frame();
  assert.equal(globals[names.mouseHeld], true, 'held again every tick, after the game lets go on a mouse up');
  game.run('fly sword --toggle');
  assert.deepEqual([globals[names.ragdollKey], globals[names.mouseHeld]], [false, false], 'toggled off: both let go');
  game.run('fly sword --on');
  game.frame();
  game.run('fly off');
  game.frame();
  assert.deepEqual([globals[names.ragdollKey], globals[names.mouseHeld]], [false, false], 'another fly mode lets go');
  assert.deepEqual(game.run('help fly').filter((line) => /sword/.test(line)).length > 0, true);
  assert.ok(game.run('help fly').some((line) => /only fly modes safe in approved and ranked matches/.test(line)), 'help says which modes are safe');
});

test('--inverse mirrors your aim height through you, so the cursor above you lifts you; --plain puts it back; both modes share it', () => {
  game.run('fly_sweep_throttle near');
  const { globals, names, player } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  player.x = 100;
  player.y = 50;
  player.tary = -30;
  assert.ok(game.run('fly sweep --inverse').some((line) => /inverse/.test(line)));
  assert.ok(game.run('get fly_sweep_aim').includes('fly_sweep_aim = inverse'));
  game.run('fly sweep --on');
  game.frame();
  player.tary = -30;
  assert.equal(player.tary, 130, '80 above you reads 80 below');
  player.y = 60;
  assert.equal(player.tary, 150, 'mirrored through where you are now');
  game.run('fly sweep --plain');
  assert.ok(game.run('get fly_sweep_aim').includes('fly_sweep_aim = plain'));
  player.tary = -30;
  assert.equal(player.tary, -30, 'plain: the cursor height as the game set it');
  game.run('fly sweep --off');
  game.run('fly sword --inverse --on');
  game.frame();
  player.tary = 0;
  assert.equal(player.tary, 120, 'sword uses it too, set and started in one line');
  game.run('fly sword --off');
  player.tary = 5;
  assert.equal(player.tary, 5, 'stopped: a plain value again');
  assert.match(errorsOf(game.run('fly sweep --inverse --plain')).join('\n'), /usage: fly/);
  assert.match(errorsOf(game.run('fly sweep --on --off')).join('\n'), /usage: fly/);
  game.run('unset fly_sweep_aim');
});

test('--directional flies toward the cursor: the cursor above lifts you, and it holds left or right toward the cursor\'s side', () => {
  game.run('fly_sweep_throttle near');
  const { globals, names, player } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  globals[names.keyLeft] = false;
  globals[names.keyRight] = false;
  player.x = 100;
  player.y = 50;
  player.tarx = 400;
  player.tary = -30;
  game.run('unset fly_sweep_aim');
  assert.ok(game.run('help fly_sweep_aim').some((line) => /"directional" \(the default\)/.test(line)), 'directional is the default');
  assert.ok(game.run('fly sweep --directional --on').some((line) => /directional/.test(line)));
  game.frame();
  player.tarx = 400;
  player.tary = -30;
  assert.equal(player.tary, 130, 'the cursor above you lifts you');
  game.frame();
  assert.deepEqual([globals[names.keyLeft], globals[names.keyRight]], [false, true], 'cursor on your right: right held');
  player.tarx = -300;
  game.frame();
  assert.deepEqual([globals[names.keyLeft], globals[names.keyRight]], [true, false], 'cursor on your left: left held');
  player.tarx = 110;
  game.frame();
  assert.deepEqual([globals[names.keyLeft], globals[names.keyRight]], [false, false], 'cursor about straight above or below: neither');
  player.tarx = 400;
  game.frame();
  game.run('fly sweep --off');
  assert.deepEqual([globals[names.keyLeft], globals[names.keyRight]], [false, false], 'stopped: let go');
  game.run('fly sweep --plain');
  game.run('fly sweep --on');
  player.tarx = 400;
  game.frame();
  game.frame();
  assert.deepEqual([globals[names.keyLeft], globals[names.keyRight]], [false, false], 'plain: no keys held');
  game.run('fly sweep --off');
  assert.ok(game.run('fly sweep --default').some((line) => /back to the default, directional/.test(line)));
  assert.ok(game.run('get fly_sweep_aim').some((line) => /fly_sweep_aim = default/.test(line)), '--default unsets it');
  game.run('fly sweep --off');
  game.run('unset fly_sweep_aim');
});

test('the sweep starts toward your cursor\'s side, so you face your cursor: while limp the game keeps the facing of that first tick', () => {
  const { globals, names, player } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  player.x = 100;
  for (const [cursorX, side] of [[400, 1], [-300, -1], [400, 1]] as const) {
    player.tarx = cursorX;
    game.run('fly sword --on');
    game.frame();
    assert.equal(Math.sign(player.tarx - player.x), side, `cursor at ${cursorX}: first aim on that side`);
    game.run('fly sword --off');
  }
});

test('edge throttle: the farther your cursor toward the screen edge, the bigger the swing; at your level, none; zoom does not matter', () => {
  const { globals, names, player } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  globals[names.zoom] = 1;
  game.run('unset fly_sweep_throttle; unset fly_sweep_curve; fly_sweep_range 500');
  assert.ok(game.run('help fly_sweep_throttle').some((line) => /"edge" \(the default\)/.test(line)));
  player.x = 100;
  player.y = 50;
  const aimAfterFrames = (cursorX: number, cursorY: number): Array<[number, number]> => {
    const aims: Array<[number, number]> = [];
    for (let frame = 0; frame < 3; frame++) {
      game.frame();
      player.tarx = cursorX;
      player.tary = cursorY;
      aims.push([Math.round(player.tarx - player.x), Math.round(player.tary - player.y)]);
    }
    return aims.slice(1);
  };
  player.tarx = 100;
  player.tary = 50;
  game.run('fly sweep --on');
  for (const [offsetX, offsetY] of aimAfterFrames(100, 50)) {
    assert.equal(offsetX, 0, 'cursor on you: no swing, both aims the same way');
    assert.equal(Math.abs(offsetY), 500, 'at the swing radius');
  }
  const full = aimAfterFrames(100, 50 - 400);
  assert.deepEqual(full.map(([offsetX]) => Math.abs(offsetX)), [500, 500], 'cursor at the top edge: level, the full swing');
  assert.ok(full[0] && full[1] && Math.sign(full[0][0]) !== Math.sign(full[1][0]), 'left then right');
  assert.ok(full.every(([, offsetY]) => Math.abs(offsetY) <= 1));
  const half = aimAfterFrames(100, 50 - 200);
  const angle = ((0.5 - 0.05) / 0.95) * Math.PI;
  for (const [offsetX, offsetY] of half) {
    assert.equal(Math.abs(offsetX), Math.round(500 * Math.sin(angle / 2)), 'half way: a part swing');
    assert.equal(offsetY, Math.round(500 * Math.cos(angle / 2)), 'aimed below you, so the cursor above lifts you');
  }
  globals[names.zoom] = 0.5;
  assert.deepEqual(aimAfterFrames(100, 50 - 400).map(([offsetX]) => Math.abs(offsetX)), half.map(([offsetX]) => Math.abs(offsetX)), 'zoomed out: twice as far for the same share of the screen');
  globals[names.zoom] = 1;
  game.run('fly_sweep_curve 2');
  const curved = aimAfterFrames(100, 50 - 200);
  assert.ok(Math.abs(curved[0]?.[0] ?? 0) < Math.abs(half[0]?.[0] ?? 0), 'a curve above 1 is gentler near you');
  game.run('unset fly_sweep_curve');
  let rightHeld = 0;
  for (let frame = 0; frame < 95; frame++) {
    game.frame();
    player.tarx = 100 + 400;
    player.tary = 50 - 400;
    if (globals[names.keyRight] === true) rightHeld++;
  }
  assert.ok(Math.abs(rightHeld - 45) <= 2, `cursor half way to the right edge: right held about half the ticks (${rightHeld} of 95)`);
  game.run('fly sweep --off; unset fly_sweep_range');
});

test('"fly sweep --on" arms the sweep mode when another one was set', () => {
  game.run('fly free');
  game.run('fly sweep --on');
  assert.ok(game.run('get fly').includes('fly = sweep'));
  game.run('fly sweep --off');
});
