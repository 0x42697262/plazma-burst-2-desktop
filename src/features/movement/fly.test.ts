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

test('"fly sweep --on" flips your aim left and right of you every tick, and the game\'s crosshair stays on your pointer', () => {
  const { globals, names, player } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  globals[names.zoom] = 1;
  globals.game.x = 0;
  globals.myCursor = { x: 0, y: 0 };
  globals.mouseX = 300;
  globals.mouseY = 150;
  player.x = 100;
  game.run('fly_sweep_range 500');
  assert.ok(game.run('fly sweep --on').some((line) => line.startsWith('Sweeping 500')));
  const aims: number[] = [];
  for (let frame = 0; frame < 2; frame++) {
    game.frame();
    aims.push(globals[names.aimSourceX] as number);
    assert.deepEqual([globals.mouseX, globals.mouseY], [0, 0], 'the mouse is held at 0, so the game neither copies it into your aim nor moves its crosshair');
    assert.deepEqual([globals.myCursor.x, globals.myCursor.y], [300, 150], 'the crosshair stays on your pointer');
    assert.equal(globals[names.aimSourceY], 150, 'aiming height still follows your pointer');
  }
  assert.deepEqual(aims.sort((left, right) => left - right), [-400, 600], 'one tick each side of x=100');
  globals.mouseX = 320;
  globals.mouseY = 160;
  game.frame();
  assert.deepEqual([globals.myCursor.x, globals.myCursor.y], [320, 160], 'moving the pointer still moves the crosshair');
  globals[names.lowPhysics] = true;
  game.frame();
  assert.deepEqual([globals.mouseX, globals.mouseY], [320, 160], 'low physics: no sweep, your pointer is given back');
  globals[names.lowPhysics] = false;
  game.frame();
  assert.ok(game.run('fly sweep --off').includes('Sweep stopped'));
  assert.deepEqual([globals.mouseX, globals.mouseY], [320, 160], 'stopped: your pointer is given back');
  globals[names.aimSourceX] = 7;
  game.frame();
  assert.equal(globals[names.aimSourceX], 7, 'stopped');
  assert.ok(game.run('fly sweep --toggle').some((line) => line.startsWith('Sweeping')));
  game.frame();
  game.run('fly off');
  assert.deepEqual([globals.mouseX, globals.mouseY], [320, 160], 'another fly mode stops it and gives the pointer back');
  assert.match(errorsOf(game.run('fly free --on')).join('\n'), /usage: fly/);
});

test('"fly sweep --on" arms the sweep mode when another one was set', () => {
  game.run('fly free');
  game.run('fly sweep --on');
  assert.ok(game.run('get fly').includes('fly = sweep'));
  game.run('fly sweep --off');
});
