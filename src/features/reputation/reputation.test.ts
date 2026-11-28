import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

type Sent = { channel: unknown; args: unknown[] };
const settled = () => new Promise((resolve) => { setImmediate(resolve); });
const OWN = '{"reputation":17,"reputation_potential":20,"skill":0.25,"wins":3,"loses":1,"online":20,"matches":8}';
const RELATIONS = JSON.stringify([
  { is_mine: 1, from: 'you', to: 'bob', is_support: 1, personal_delta: 0, relative_since: -2 * 86400000 - 3 * 3600000, relative_cap_time_until: 5 * 3600000, is_active: true },
  { is_mine: 0, from: 'eve', to: 'you', is_support: 0, personal_delta: -2, relative_since: -60000, relative_cap_time_until: 86400000, is_active: true },
  { is_mine: 0, from: 'amy', to: 'you', is_support: 1, personal_delta: 6, relative_since: -3 * 86400000, relative_cap_time_until: -86400000, is_active: false },
]);

async function lobbyGame(answer: (args: unknown[]) => unknown[] | null) {
  const game = await bootConsole();
  const { globals, names } = game;
  const net = globals[names.net];
  const placeholder = {};
  const sent: Sent[] = [];
  Object.assign(net, {
    RELIABLE_GET_MATCH_LIST: 'LIST', [names.netChannel]: 'CHANNEL', [names.netReplyTo]: placeholder, [names.lobbyReady]: true,
    [names.lobbyConn]: { [names.netSend]: (channel: unknown, args: unknown[], reply: (parts: unknown[]) => void) => {
      sent.push({ channel, args });
      const parts = answer(args);
      if (parts) reply(parts);
    } },
  });
  const printedAfter = async (line: string): Promise<string[]> => {
    game.log.printed.length = 0;
    game.run(line);
    await settled();
    return game.log.printed.map(String);
  };
  return { game, net, names, placeholder, sent, printedAfter };
}

test('rep asks the lobby for its match list and shows your numbers', async () => {
  const { sent, placeholder, printedAfter } = await lobbyGame(() => ['ok', '[]', OWN]);
  const lines = await printedAfter('rep');
  assert.deepEqual(sent[0]?.args, ['LIST', '{}', placeholder, 'match_list'], 'the request the lobby screen sends, with the reply placeholder');
  assert.equal(sent[0]?.channel, 'CHANNEL');
  assert.ok(lines.includes('Reputation 17 (potential 20)'), lines.join('\n'));
  assert.ok(lines.includes('Skill 0.25, wins 3, losses 1'), lines.join('\n'));
});

test('rep relations shows each relation: which way, the points, and how long it lasts', async () => {
  const { sent, printedAfter } = await lobbyGame(() => ['ok', RELATIONS, OWN]);
  const lines = await printedAfter('rep relations');
  assert.equal(sent[0]?.args[3], 'relations');
  assert.ok(lines.includes('Relations (3):'), lines.join('\n'));
  assert.ok(lines.includes('  fit    you -> bob  delta 0  active, since 2d 3h, ends in 5h 0m'), lines.join('\n'));
  assert.ok(lines.includes('  unfit  eve -> you  delta -2  active, since 1m, ends in 1d 0h'), lines.join('\n'));
  assert.ok(lines.includes('  fit    amy -> you  delta +6  ended, made 3d 0h ago'), lines.join('\n'));
});

test('a refusal, no answer before login, and arguments are reported', async () => {
  const refused = await lobbyGame(() => ['fail', 'Match listing error: Too fast']);
  assert.ok((await refused.printedAfter('rep')).includes('the lobby refused: Match listing error: Too fast'));
  const loggedOut = await lobbyGame(() => null);
  loggedOut.net[loggedOut.names.lobbyReady] = null;
  assert.ok((await loggedOut.printedAfter('rep')).some((line) => /not logged in to the lobby/.test(line)));
  const fresh = await bootConsole();
  assert.match(errorsOf(fresh.run('rep now'))[0] ?? '', /usage: rep/);
  assert.match(errorsOf(fresh.run('rep relations all'))[0] ?? '', /usage: rep relations/);
});

test('rep players lists the reputation and skill the match sends for each player', async () => {
  const { game } = await lobbyGame(() => null);
  game.chars[0].reputation = 17;
  game.chars[0].skill = 0.25;
  game.chars[1].reputation = 0;
  game.chars[1].skill = 1;
  assert.deepEqual(game.run('rep players'), [
    '  #0  you                  rep   17  skill 0.25 (you)',
    '  #1  bob                  rep    0  skill 1.00',
    '  #2  bluebot              rep    -  skill -',
  ]);
  game.globals[game.names.mp] = false;
  assert.match(errorsOf(game.run('rep players'))[0] ?? '', /Not in a match/);
});

test('rep entry tags this login\'s entry by its relations and compares it with the entries seen earlier in this window', async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value); } } });
  const rows = (starts: number[]) => JSON.stringify(starts.map((since) => ({ is_mine: 1, from: 'you', to: 'bob', is_support: 1, personal_delta: 0, since, relative_since: -1, relative_cap_time_until: 1, is_active: true })));
  let answer = rows([1700000000000, 1700000600000]);
  const { net, names, printedAfter } = await lobbyGame(() => ['ok', answer, OWN]);
  net[names.connUser] = { login: 'you', is_vpn: false };
  const first = await printedAfter('rep entry');
  assert.ok(first.some((line) => /^Entry [0-9a-f]{8}: 2 relations, the oldest from 2023-11-14T22:13 UTC$/.test(line)), first.join('\n'));
  assert.ok(first.includes('Reputation 17'));
  assert.ok(first.includes('Lobby VPN flag: false'));
  assert.ok(first.some((line) => /no entry yet/.test(line)));
  const second = await printedAfter('rep entry');
  assert.ok(second.some((line) => /: the same entry \(reputation 17\)$/.test(line)), second.join('\n'));
  answer = rows([1600000000000]);
  const third = await printedAfter('rep entry');
  assert.ok(third.some((line) => /nothing shared: another entry/.test(line)), third.join('\n'));
  answer = rows([1700000600000, 1700000900000]);
  const fourth = await printedAfter('rep entry');
  assert.ok(fourth.some((line) => /shares 1 of 2 relations: likely the same/.test(line)), fourth.join('\n'));
  Reflect.deleteProperty(globalThis, 'sessionStorage');
});
