import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const nicknamesOf = (rows: unknown[]): string[] => rows.map((row) => String(row).trim().split(/\s+/)[1] ?? '');

test('chars: everyone, with the game\'s team names', async () => {
  const game = await bootConsole();
  assert.deepEqual(game.run('chars'), [
    '  #0   you              team Alpha     hp 130/130     alive      0px (you)',
    '  #1   bob              team Alpha     hp 130/130     alive    112px ally',
    '  #2   bluebot          team Blue Team hp 100/100     alive    608px enemy',
  ]);
});

test('chars: a team by its name or the start of it, any case, several teams together', async () => {
  const game = await bootConsole();
  assert.deepEqual(nicknamesOf(game.run('chars alpha')), ['you', 'bob']);
  assert.deepEqual(nicknamesOf(game.run('chars ALP')), ['you', 'bob']);
  assert.deepEqual(nicknamesOf(game.run('chars blue')), ['bluebot'], '"Blue Team" answers to blue');
  assert.deepEqual(nicknamesOf(game.run('chars alpha blue')), ['you', 'bob', 'bluebot']);
});

test('chars: players and bots, alone or with a team', async () => {
  const game = await bootConsole();
  assert.deepEqual(nicknamesOf(game.run('chars players')), ['you', 'bob']);
  assert.deepEqual(nicknamesOf(game.run('chars bots')), ['bluebot']);
  assert.deepEqual(game.run('chars blue players'), ['No character matches "blue players"']);
});

test('players and bots: the same list as chars with that filter, and they take a team', async () => {
  const game = await bootConsole();
  assert.deepEqual(game.run('players'), game.run('chars players'));
  assert.deepEqual(game.run('bots'), game.run('chars bots'));
  assert.deepEqual(nicknamesOf(game.run('players alpha')), ['you', 'bob']);
  assert.deepEqual(game.run('players blue'), ['No character matches "players blue"']);
});

test('chars: a word that is not a filter is an error, not ignored', async () => {
  const game = await bootConsole();
  assert.match(errorsOf(game.run('chars zzz'))[0], /"zzz" is not a filter.*alpha.*red/);
  assert.match(errorsOf(game.run('chars c'))[0], /more than one team: Counter-Terrorists, Civil Security/);
  assert.match(errorsOf(game.run('chars players bots'))[0], /not both/);
  assert.match(errorsOf(game.run('bots players'))[0], /not both/);
});

test('chars: without the game\'s team names, the number shows and a team word is refused', async () => {
  const game = await bootConsole();
  const { globals, names } = game;
  const net = globals[names.net];
  const saved = net[names.teamNames];
  delete net[names.teamNames];
  try {
    assert.match(String(game.run('chars')[2]), /team 13 /);
    assert.deepEqual(nicknamesOf(game.run('chars bots')), ['bluebot']);
    assert.match(errorsOf(game.run('chars alpha'))[0], /no team names/);
  } finally {
    net[names.teamNames] = saved;
  }
});
