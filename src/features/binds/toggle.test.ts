import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole, type FakeGame } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const FPS_TOGGLE = 'bind --toggle shift+f "fps 60 high unlimited" "fps 30 low match"';
const FAST = 'FPS 60, physics high, logic unlimited';
const SLOW = 'FPS 30, physics low, logic match';
const REFRESH_RATE_GLOBAL = 'UNLIMITED_SCREEN_REFRESH_RATE';

let game: FakeGame;
before(async () => {
  game = await bootConsole();
  game.G[game.N.fpsChoice] = 1;
  game.G[game.N.lowPhysics] = true;
  game.G[game.N.applyFps] = () => undefined;
  game.G[game.N.syncPointHistory] = () => undefined;
  Reflect.set(globalThis, REFRESH_RATE_GLOBAL, false);
});
afterEach(() => { game.run('unbind --all'); });

const shiftF = (): string[] => game.press('KeyF', { shiftKey: true });
const withoutNotes = (lines: readonly string[]): string[] => lines.filter((line) => !line.startsWith('Note:'));

test('pressing the key switches between the two commands, and goes round again', () => {
  assert.deepEqual(errorsOf(game.run(FPS_TOGGLE)), []);
  assert.ok(shiftF().includes(FAST), 'first press: the first command');
  assert.ok(shiftF().includes(SLOW), 'second press: the second command');
  assert.ok(shiftF().includes(FAST), 'third press: back to the first');
  assert.deepEqual(withoutNotes(game.run('fps')), [FAST]);
});

test('holding the key down does not flip the toggle again: only a new press does', () => {
  game.run(FPS_TOGGLE);
  assert.ok(shiftF().includes(FAST));
  game.log.printed.length = 0;
  for (let repeat = 0; repeat < 3; repeat++) game.dispatch(null, 'keydown', { code: 'KeyF', key: 'KeyF', shiftKey: true, repeat: true });
  assert.deepEqual(game.log.printed, [], 'key repeats ran nothing');
  assert.ok(shiftF().includes(SLOW), 'the next real press is the second command');
});

test('a toggle takes more than two commands and cycles through them', () => {
  assert.deepEqual(errorsOf(game.run('bind --toggle f "heal" "pos" "where"')), []);
  const echoes = [0, 1, 2, 3].map(() => game.press('KeyF')[0]);
  assert.deepEqual(echoes, ['[bind f] > heal', '[bind f] > pos', '[bind f] > where', '[bind f] > heal']);
});

test('a toggle is listed and saved as one bind with a toggle mark', () => {
  game.run(FPS_TOGGLE);
  assert.ok(game.run('bind').some((line) => line.includes('shift+f (toggle)')));
  const saved = JSON.parse(game.store.get('pb2dev_kv') ?? '{}') as Record<string, unknown>;
  assert.deepEqual(saved.toggle_binds, ['shift+f']);
  assert.deepEqual(saved.binds, { 'shift+f': 'fps 60 high unlimited; fps 30 low match' });
});

test('a toggle goes with --pass and works on a mouse button', () => {
  let gameSawIt = 0;
  game.globals.onmousedown = () => { gameSawIt++; };
  assert.deepEqual(errorsOf(game.run('bind --toggle --pass mouse1 "heal" "pos"')), []);
  assert.ok(game.run('bind').some((line) => line.includes('mouse1 (toggle, pass)')));
  const clicks: string[] = [];
  for (let click = 0; click < 3; click++) {
    game.log.printed.length = 0;
    game.dispatch(null, 'mousedown', { button: 0 });
    game.dispatch(null, 'mouseup', { button: 0 });
    clicks.push(game.log.printed[0] ?? '');
  }
  assert.deepEqual(clicks, ['[bind mouse1] > heal', '[bind mouse1] > pos', '[bind mouse1] > heal']);
  assert.equal(gameSawIt, 3, 'passed: the game saw every click');
});

test('a toggle needs two or more quoted commands that each start with something that runs', () => {
  assert.match(errorsOf(game.run('bind --toggle f "heal"')).join('\n'), /usage: bind --toggle/);
  assert.match(errorsOf(game.run('bind --toggle f heal pos')).join('\n'), /usage: bind --toggle/);
  assert.match(errorsOf(game.run('bind --toggle f')).join('\n'), /usage: bind --toggle/);
  assert.match(errorsOf(game.run('bind --toggle f "heal" "nonsense"')).join('\n'), /unknown command "nonsense"/);
  assert.match(errorsOf(game.run('bind --toggle f "heal; nonsense" "god"')).join('\n'), /unknown command "nonsense"/);
  assert.match(errorsOf(game.run('bind --toggle --hold f "heal" "pos"')).join('\n'), /cannot also be held/);
  assert.deepEqual(game.run('bind f'), ['f is not bound'], 'nothing was bound');
});

test('binding the key again replaces the toggle, and a rebound toggle starts from its first command', () => {
  game.run('bind --toggle f "heal" "pos"');
  assert.equal(game.press('KeyF')[0], '[bind f] > heal');
  game.run('bind --toggle f "heal" "pos"');
  assert.equal(game.press('KeyF')[0], '[bind f] > heal', 'started over');
  game.run('bind f where');
  assert.ok(!game.run('bind').some((line) => line.includes('(toggle)')), 'a plain bind is no toggle');
  assert.equal(game.press('KeyF')[0], '[bind f] > where');
  assert.equal(game.press('KeyF')[0], '[bind f] > where');
  game.run('bind --toggle f "heal" "pos"');
  game.run('unbind f');
  const saved = JSON.parse(game.store.get('pb2dev_kv') ?? '{}') as Record<string, unknown>;
  assert.equal(saved.toggle_binds, undefined, 'unbind forgets the toggle mark');
});

const GUN_TOGGLE = 'bind --toggle shift+h "triggers exec SetGunPower( "#gun*12", "30" );" "triggers exec SetGunPower( "#gun*12", "1" );"';
const GUN_30 = 'triggers exec SetGunPower( "#gun*12", "30" );';
const GUN_1 = 'triggers exec SetGunPower( "#gun*12", "1" );';

test('a toggle command may contain quotes and a trailing semicolon of its own', () => {
  assert.deepEqual(errorsOf(game.run(GUN_TOGGLE)), []);
  const echoes = [0, 1, 2].map(() => game.press('KeyH', { shiftKey: true })[0]);
  assert.deepEqual(echoes, [`[bind shift+h] > ${GUN_30}`, `[bind shift+h] > ${GUN_1}`, `[bind shift+h] > ${GUN_30}`]);
  assert.ok(game.run('bind').some((line) => line.includes('shift+h (toggle)') && line.includes(GUN_30) && line.includes(GUN_1)));
});

test('a toggle with quotes survives being saved and loaded', () => {
  game.run(GUN_TOGGLE);
  const saved = JSON.parse(game.store.get('pb2dev_kv') ?? '{}') as { binds?: Record<string, string>; toggle_binds?: string[] };
  assert.deepEqual(saved.toggle_binds, ['shift+h']);
  assert.ok(saved.binds?.['shift+h']?.includes('SetGunPower'));
});

test('each toggle step can be several commands: one, then two, then round again', () => {
  assert.deepEqual(errorsOf(game.run('bind --toggle f "heal" "heal; pos"')), []);
  const first = game.press('KeyF').join('\n');
  const second = game.press('KeyF').join('\n');
  const third = game.press('KeyF').join('\n');
  assert.ok(first.includes('> heal') && !first.includes('pos'), 'press 1: only heal');
  assert.ok(second.includes('heal') && second.includes('pos'), 'press 2: both commands');
  assert.ok(!third.includes('pos'), 'press 3: back to the single command');
  assert.ok(game.run('bind').some((line) => line.includes('"heal" "heal; pos"')));
});

test('two commands on each of two steps', () => {
  assert.deepEqual(errorsOf(game.run('bind --toggle f "heal; pos" "where; god"')), []);
  assert.ok(game.press('KeyF').join('\n').includes('pos'));
  assert.ok(game.press('KeyF').join('\n').includes('where'));
  assert.ok(game.press('KeyF').join('\n').includes('pos'));
});

const SHOW_TOGGLE = 'bind --toggle mouse4 "fps 60 high unlimited; triggers exec ShowText( "60 high", "#FFF000" );" "fps 30 low match; triggers exec ShowText( "30 low", "#FFF000" );"';

test('a toggle step may chain a normal command with a triggers exec script', () => {
  assert.deepEqual(errorsOf(game.run(SHOW_TOGGLE)), []);
  const press = game.press('Mouse4').join('\n');
  assert.ok(press.includes('triggers exec ShowText( "60 high", "#FFF000" );'));
  assert.ok(!press.includes('not an action'));
});
