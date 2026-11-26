import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { splitCommands } from '../dispatch.ts';
import { forgetAllToggleSteps, forgetToggleStep, formatToggleChoices, joinToggleChoices, nextToggleCommand, toggleChoices } from './toggle.ts';

test('plain toggle choices join with "; " and split back cleanly', () => {
  const stored = joinToggleChoices(['fps 60 high unlimited', 'fps 30 low match']);
  assert.equal(stored, 'fps 60 high unlimited; fps 30 low match');
  assert.deepEqual(toggleChoices(stored), ['fps 60 high unlimited', 'fps 30 low match']);
  assert.equal(formatToggleChoices(stored), '"fps 60 high unlimited" "fps 30 low match"');
});

test('toggle choices with semicolons or quotes round-trip through escaped quotes', () => {
  const choices = ['fps 60; triggers exec ShowText( "60", "#FFF000" );', 'heal; pos'];
  const stored = joinToggleChoices(choices);
  assert.deepEqual(toggleChoices(stored), choices);
  assert.equal(formatToggleChoices(stored), `"${choices[0]}" "${choices[1]}"`);
});

test('nextToggleCommand cycles per key and resets when forgotten', () => {
  forgetAllToggleSteps();
  const stored = joinToggleChoices(['heal', 'pos', 'where']);
  assert.equal(nextToggleCommand('f', stored), 'heal');
  assert.equal(nextToggleCommand('f', stored), 'pos');
  assert.equal(nextToggleCommand('g', stored), 'heal');
  assert.equal(nextToggleCommand('f', stored), 'where');
  assert.equal(nextToggleCommand('f', stored), 'heal');
  forgetToggleStep('f');
  assert.equal(nextToggleCommand('f', stored), 'heal');
  forgetAllToggleSteps();
  assert.equal(nextToggleCommand('g', stored), 'heal');
});

test('splitCommands keeps a trailing rawLine command intact after a semicolon chain', async () => {
  await bootConsole();
  assert.deepEqual(
    splitCommands('fps 60 high unlimited; triggers exec ShowText( "60 high", "#FFF000" );'),
    ['fps 60 high unlimited', 'triggers exec ShowText( "60 high", "#FFF000" );'],
  );
  assert.deepEqual(
    splitCommands('heal; js const one = 1; const two = 2;'),
    ['heal', 'js const one = 1; const two = 2;'],
  );
});
