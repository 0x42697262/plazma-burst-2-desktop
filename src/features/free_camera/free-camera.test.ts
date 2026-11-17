import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFreeCamera, type CameraView } from './services/free-camera.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

type FakeView = CameraView & { offset: { x: number; y: number }; zoomLevel: number; active: boolean; alive: boolean; watched: boolean };

function setup() {
  const view: FakeView = {
    offset: { x: 0, y: 0 }, zoomLevel: 1, active: true, alive: true, watched: false,
    isActive() { return this.active; },
    isAlive() { return this.alive; },
    isWatched() { return this.watched; },
    refusal: () => new Error('refused: aim'),
    levelRequired: () => new Error('needs a level'),
    zoom() { return this.zoomLevel; },
    worldOffset() { return { ...this.offset }; },
    setWorldOffset(offsetX, offsetY) { this.offset = { x: offsetX, y: offsetY }; },
    stageScale: () => 2,
    speed: () => 900,
    fastFactor: () => 3,
  };
  let time = 0;
  const said: string[] = [];
  const camera = createFreeCamera({ view, now: () => time, say: (text) => said.push(text), warn: (text) => said.push(text) });
  const FRAME_MS = 50;
  const jump = (milliseconds: number) => { time += milliseconds; camera.frame(); };
  const advance = (milliseconds: number) => {
    for (let left = milliseconds; left > 0; left -= FRAME_MS) jump(Math.min(FRAME_MS, left));
    if (milliseconds === 0) jump(0);
  };
  const key = (code: string, shiftKey = false) => ({ code, shiftKey });
  return { view, camera, advance, jump, key, said };
}

test('free camera: the movement keys pan the view at freecam_speed screen pixels a second, Shift three times faster, and are kept from the game', () => {
  const { view, camera, advance, jump, key } = setup();
  assert.equal(camera.keyDown(key('KeyD')), false, 'off: the keys go to the game');
  camera.turnOn();
  assert.equal(camera.keyDown(key('KeyD')), true, 'on: kept from the game');
  advance(1000);
  assert.equal(view.offset.x, -900, 'one second to the right: the world moves 900 pixels left');
  camera.keyUp(key('KeyD'));
  advance(1000);
  assert.equal(view.offset.x, -900, 'let go: it stops');
  camera.keyDown(key('ArrowUp', true));
  advance(500);
  assert.equal(view.offset.y, 1350, 'up with Shift: three times as fast');
  camera.keyUp(key('ArrowUp'));
  assert.equal(camera.keyDown(key('KeyE')), false, 'other keys still reach the game');
  view.zoomLevel = 0.5;
  advance(0);
  const zoomedOut = view.offset.x;
  camera.keyDown(key('KeyA'));
  advance(1000);
  assert.equal(view.offset.x - zoomedOut, 900, 'the same screen speed at any zoom');
  const beforePause = view.offset.x;
  jump(5000);
  assert.equal(view.offset.x - beforePause, 90, 'a long pause moves at most a tenth of a second');
});

test('free camera: it holds the view still against the game, zoom keeps the center, a middle drag drags the map', () => {
  const { view, camera, advance } = setup();
  view.offset = { x: 100, y: 50 };
  camera.turnOn();
  view.offset = { x: 400, y: 300 };
  advance(16);
  assert.deepEqual(view.offset, { x: 100, y: 50 }, 'the game moved the camera; it is put back');
  view.zoomLevel = 2;
  advance(16);
  assert.deepEqual(view.offset, { x: 400 - 300 * 2, y: 200 - 150 * 2 }, 'zoomed in about the same center');
  view.zoomLevel = 1;
  advance(16);
  assert.equal(camera.mouseDown({ button: 0, clientX: 0, clientY: 0 }), false, 'a left click goes to the game');
  assert.equal(camera.mouseDown({ button: 1, clientX: 10, clientY: 10 }), true, 'a middle press starts a drag');
  camera.mouseMove({ clientX: 30, clientY: 0 });
  advance(16);
  assert.deepEqual(view.offset, { x: 100 + 40, y: 50 - 20 }, 'the map follows the mouse, in game pixels');
  assert.equal(camera.mouseUp({ button: 1 }), true);
  camera.mouseMove({ clientX: 300, clientY: 300 });
  advance(16);
  assert.deepEqual(view.offset, { x: 140, y: 30 }, 'released: no more drag');
});

test('free camera: it ends when the level ends, you die or a match becomes approved, and refuses to start in one', () => {
  const { view, camera, advance, said } = setup();
  camera.turnOn();
  view.alive = false;
  advance(16);
  assert.equal(camera.isOn(), false, 'died: off');
  view.alive = true;
  camera.turnOn();
  view.active = false;
  advance(16);
  assert.equal(camera.isOn(), false, 'level ended: off');
  assert.throws(() => camera.turnOn(), /needs a level/);
  view.active = true;
  view.watched = true;
  assert.throws(() => camera.turnOn(), /refused/);
  view.watched = false;
  camera.turnOn();
  view.watched = true;
  advance(16);
  assert.equal(camera.isOn(), false, 'the match became approved: off');
  assert.ok(said.some((line) => /approved/.test(line)));
  view.watched = false;
  camera.turnOn();
  camera.keyDown({ code: 'KeyD', shiftKey: false });
  camera.releaseAll();
  const before = view.offset.x;
  advance(1000);
  assert.equal(view.offset.x, before, 'the window lost focus: the keys are let go');
});

test('freecam: the command toggles, --on/--off for hold binds, the game never gets the pan keys, and approved matches refuse it', async () => {
  const game = await bootConsole();
  const { globals, names } = game;
  globals.game.x = 0;
  globals.game.y = 0;
  assert.ok(game.run('freecam').some((line) => /Free camera on/.test(line)));
  assert.ok(game.run('freecam').some((line) => /Free camera off/.test(line)));
  game.run('freecam --on');
  const event = game.dispatch(null, 'keydown', { code: 'KeyD', key: 'd', repeat: false });
  assert.equal(event.defaultPrevented, true, 'D is kept from the game');
  game.dispatch(null, 'keyup', { code: 'KeyD', key: 'd' });
  game.run('freecam --off');
  game.run('bind --hold f4 freecam');
  assert.ok(game.run('bind').some((line) => /f4 \(hold\)/.test(line)));
  game.run('unbind f4');
  globals[names.mp] = true;
  globals[names.net].match_details = { approved: 1, ranked: false };
  assert.match(errorsOf(game.run('freecam --on')).join('\n'), /bypass checks/);
  globals[names.mp] = false;
  assert.match(errorsOf(game.run('freecam --sideways')).join('\n'), /unknown option.*--on, --off/);
  assert.match(errorsOf(game.run('freecam now')).join('\n'), /usage: freecam/);
  assert.ok(game.run('help freecam_speed').some((line) => /900/.test(line)));
});
