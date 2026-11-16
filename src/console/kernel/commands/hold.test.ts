import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { holdCommands, mouseButtonName } from './hold.ts';

test('a held bind runs --on when pressed and --off when let go, or on/off for an on/off setting', async () => {
  await bootConsole();
  assert.deepEqual(holdCommands('fly sweep'), { press: 'fly sweep --on', release: 'fly sweep --off' });
  assert.deepEqual(holdCommands('god'), { press: 'god on', release: 'god off' });
  assert.equal(holdCommands('heal'), null, 'heal has no on and off');
  assert.equal(holdCommands('speed'), null, 'a number setting cannot be held');
  assert.equal(holdCommands('god; heal'), null, 'one command, not a chain');
  assert.equal(holdCommands('nothing'), null);
});

test('mouse buttons are named mouse1 to mouse5, with the held modifiers', () => {
  assert.equal(mouseButtonName({ button: 0 }), 'mouse1');
  assert.equal(mouseButtonName({ button: 2, ctrlKey: true }), 'ctrl+mouse2');
  assert.equal(mouseButtonName({ button: 1, shiftKey: true, altKey: true }), 'alt+shift+mouse3');
  assert.equal(mouseButtonName({ button: 4 }), 'mouse5');
  assert.equal(mouseButtonName({ button: 7 }), '');
});
