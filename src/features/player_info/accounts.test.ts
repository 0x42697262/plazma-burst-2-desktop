import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

test('accounts: slot, nickname, login and auth id of everyone connected', async () => {
  const game = await bootConsole();
  const { chars } = game;
  chars[0].login = 'example login';
  chars[0].auth_id = 322947;
  chars[1].login = '.guest';
  chars[1].auth_id = 322951;
  assert.deepEqual(game.run('accounts'), [
    '  #0   you              example login        auth   322947 (you)',
    '  #1   bob              .guest               auth   322951',
    '  #2   bluebot          -                    auth        -',
  ]);
});

test('accounts: a player whose account has not arrived shows "?", a bot "-"', async () => {
  const game = await bootConsole();
  const { chars, names } = game;
  chars[1].login = '';
  delete chars[1].auth_id;
  assert.equal(game.run('accounts')[1], '  #1   bob              -                    auth        ?');
  chars[1][names.charHuman] = false;
  chars[1].auth_id = 322951;
  assert.equal(game.run('accounts')[1], '  #1   bob              -                    auth        -', 'a bot has no account, whatever it carries');
});

test('accounts: offline there is nobody connected', async () => {
  const game = await bootConsole();
  game.globals[game.names.mp] = false;
  assert.match(errorsOf(game.run('accounts'))[0], /Not in a match/);
});

test('accounts: authids and ids answer the same', async () => {
  const game = await bootConsole();
  assert.deepEqual(game.run('authids'), game.run('accounts'));
  assert.deepEqual(game.run('ids'), game.run('accounts'));
});

test('accounts: needs a level', async () => {
  const game = await bootConsole();
  game.chars.length = 0;
  assert.match(errorsOf(game.run('accounts'))[0], /level/i);
});

test('accounts: a spectator has no character and is listed from the slot table', async () => {
  const game = await bootConsole();
  const { globals, names } = game;
  const spectator = { io: true, nickname: 'watcher', login: 'watching', auth_id: 322999, [names.connSpectator]: true, [names.charHuman]: true };
  globals[names.playersBySlot] = [undefined, undefined, undefined, undefined, spectator];
  const rows = game.run('accounts');
  assert.equal(rows.length, 4, 'three characters and one spectator, slot #3 empty');
  assert.match(String(rows[3]), /#4\s+watcher\s+watching\s+auth\s+322999 \(spectating\)$/);
});
