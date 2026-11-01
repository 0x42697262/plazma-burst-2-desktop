import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole, type FakeGame } from '../../../test/support/fake-game.mjs';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

let game: FakeGame;
before(async () => { game = await bootConsole(); });

test('a bind can only start with something that runs', () => {
  assert.deepEqual(errorsOf(game.run('bind f tp')), []);
  assert.deepEqual(errorsOf(game.run('bind f speed 2')), [], 'a key works too');
  assert.match(errorsOf(game.run('bind f chain'))[0] ?? '', /unknown command "chain"/, 'a help-only topic does not');
  game.run('unbind all');
});

test('a bind holds a ";" chain, and pressing the key runs all of it', () => {
  assert.deepEqual(errorsOf(game.run('bind shift+t "revive; god"')), [], 'a one-word first command');
  const out = game.press('KeyT', { shiftKey: true });
  assert.equal(out[0], '[bind shift+t] > revive; god');
  assert.ok(out.includes('[1/2] revive') && out.includes('[2/2] god'), out.join(' | '));
  assert.match(errorsOf(game.run('bind g "revive; nonsense"'))[0] ?? '', /unknown command "nonsense"\./, 'every command is checked');
  assert.match(errorsOf(game.run('bind g "revive; nonsense 5"'))[0] ?? '', /unknown command "nonsense" in "nonsense 5"/);
  assert.deepEqual(errorsOf(game.run('bind h fast load maps on')), [], 'a phrase is checked as its key');
  game.run('unbind all; unset god');
});

test('shifted characters are Shift and their US key; keyname names the key you press', () => {
  game.run('unbind --all');
  const shifted: [string, string][] = [['>', 'shift+period'], ['?', 'shift+slash'], ['<', 'shift+comma'], [':', 'shift+semicolon'],
    ['!', 'shift+1'], ['{', 'shift+bracketleft'], ['|', 'shift+backslash'], ['_', 'shift+minus'], ['+', 'shift+equal'],
    ['ctrl+>', 'ctrl+shift+period'], ['shift+>', 'shift+period'], ['ctrl++', 'ctrl+shift+equal']];
  for (const [typed, name] of shifted) {
    assert.equal(game.run(`bind ${typed} heal`)[0], `${name} = heal`, typed);
  }
  assert.match(errorsOf(game.run('bind ~ heal'))[0] ?? '', /opens the console/, '~ is Shift+`');
  assert.match(errorsOf(game.run('bind ¤ heal'))[0] ?? '', /not a key name.*"keyname" shows a key's name/);
  game.run('unbind --all');

  game.run('bind shift+period heal');
  assert.match(game.run('keyname')[0] ?? '', /^Press a key/);
  assert.deepEqual(game.press('ShiftLeft', { key: 'Shift', shiftKey: true }), [], 'waits for the whole combination');
  const out = game.press('Period', { key: '>', shiftKey: true });
  assert.deepEqual(out, ['shift+period', '  types ">", code Period', '  bound to: heal', '  bind shift+period <command>'], out.join(' | '));
  assert.ok(game.press('Period', { key: '>', shiftKey: true }).some((line) => /HP = /.test(line)), 'then the bind works again');

  game.run('keyname');
  const f12 = game.press('F12', { key: 'F12' });
  assert.deepEqual(f12.slice(0, 3), ['f12', '  key "F12", code F12', '  the screenshot key ("screenshot_key")']);
  game.run('keyname');
  assert.ok(game.press('KeyW', { key: 'w' }).includes('  game key: jump'));
  game.run('keyname');
  assert.ok(game.press('Backquote', { key: '~', shiftKey: true }).includes('  cannot be bound: shift+` opens the console'));
  game.run('keyname');
  assert.deepEqual(game.press('Escape', { key: 'Escape' }), ['keyname: cancelled']);
  game.run('unbind --all');
});
