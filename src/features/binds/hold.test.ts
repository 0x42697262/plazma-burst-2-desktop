import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole, type FakeGame } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const key = (code: string) => ({ code, key: code, repeat: false });

let game: FakeGame;
before(async () => { game = await bootConsole(); });

test('a held bind runs --on while the key is down and --off when it comes up, even after its modifier', () => {
  const { globals, names } = game;
  globals[names.fpsChoice] = 3;
  globals[names.lowPhysics] = false;
  game.run('bind --hold ctrl+t fly sweep');
  assert.ok(game.run('bind').some((line) => line.includes('ctrl+t (hold)')));
  game.dispatch(null, 'keydown', { ...key('KeyT'), ctrlKey: true });
  assert.ok(game.run('get fly').includes('fly = sweep'), 'pressed: --on armed it');
  game.frame();
  game.player.tarx = 7;
  assert.notEqual(game.player.tarx, 7, 'sweeping while held');
  game.dispatch(null, 'keydown', { ...key('KeyT'), ctrlKey: true, repeat: true });
  game.dispatch(null, 'keyup', { ...key('KeyT'), ctrlKey: false });
  game.frame();
  game.player.tarx = 7;
  assert.equal(game.player.tarx, 7, 'let go: stopped, though ctrl came up first');
  game.run('unbind ctrl+t; fly off');
});

test('mouse buttons bind like keys and never reach the game; opening the console lets go of a held one', () => {
  let gameSawIt = 0;
  game.globals.onmousedown = () => { gameSawIt++; };
  game.run('bind --hold mouse2 god');
  game.dispatch(null, 'mousedown', { button: 2 });
  assert.equal(gameSawIt, 0, 'the game never saw the bound button');
  assert.ok(game.run('get god').includes('god = on'), 'held: on');
  game.dispatch(null, 'mouseup', { button: 2 });
  assert.ok(game.run('get god').includes('god = off'), 'let go: off');
  game.dispatch(null, 'mousedown', { button: 2 });
  assert.ok(game.run('get god').includes('god = on'));
  game.globals.pb2dev.open();
  game.globals.pb2dev.close();
  assert.ok(game.run('get god').includes('god = off'), 'the console opened: let go');
  game.dispatch(null, 'mouseup', { button: 2 });
  game.dispatch(null, 'mousedown', { button: 0 });
  assert.equal(gameSawIt, 1, 'an unbound button still reaches the game');
  game.run('bind mouse4 heal');
  game.dispatch(null, 'mousedown', { button: 3 });
  game.dispatch(null, 'mouseup', { button: 3 });
  assert.equal(gameSawIt, 1);
  game.run('unbind mouse2; unbind mouse4; unset god');
});

test('only commands with --on/--off, or on/off keys, can be held', () => {
  assert.match(errorsOf(game.run('bind --hold f heal')).join('\n'), /cannot be held/);
  assert.match(errorsOf(game.run('bind --hold f')).join('\n'), /usage: bind --hold/);
  assert.deepEqual(game.run('bind f'), ['f is not bound']);
});
