import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

type Sent = { channel: unknown; args: unknown[]; reply: unknown };

async function wiredGame() {
  const game = await bootConsole();
  const { globals, names } = game;
  const net = globals[names.net];
  const placeholder = {};
  const sent: Sent[] = [];
  const connection = (label: string) => ({ label, [names.netSend]: (channel: unknown, args: unknown[], reply: unknown) => { sent.push({ channel, args: [label, ...args], reply }); } });
  Object.assign(net, {
    RELIABLE_HEAL_PLAYER: 'HEAL', RELIABLE_ENTER_RESPAWN_QUEUE: 'QUEUE', RELIABLE_DAMAGE_PLAYERS_VIA_EXPLOSION: 'BOOM',
    [names.netChannel]: 'CHANNEL', [names.netReplyTo]: placeholder, [names.lobbyConn]: connection('lobby'),
  });
  game.log.net.length = 0;
  return { game, net, names, placeholder, sent, connection };
}

test('a message without a reply goes through the game\'s Event, numbers encoded and scaled', async () => {
  const { game } = await wiredGame();
  game.chars[0].curwea = 3;
  game.chars[1].respawns = 2;
  game.run('wire heal_player target=bob power=5');
  assert.deepEqual(game.log.net, [['HEAL', 'n500', 'n3', 'n1', 'n2']], 'power x100, your held gun, slot 1, bob\'s respawn counter');
});

test('a match request is sent with a callback, so the game swaps the placeholder for a reply id', async () => {
  const { game, placeholder, sent } = await wiredGame();
  const lines = game.run('wire enter_respawn_queue');
  assert.equal(game.log.net.length, 0, 'not through Event, which would put the raw placeholder on the wire');
  assert.equal(sent.length, 1);
  const [request] = sent;
  assert.deepEqual(request?.args, ['lobby', 'QUEUE', placeholder]);
  assert.strictEqual(request?.args[2], placeholder, 'the placeholder object itself, which the game replaces');
  assert.equal(request?.channel, 'CHANNEL');
  assert.equal(typeof request?.reply, 'function', 'a callback, which is what makes the game swap the placeholder');
  assert.ok(lines.some((line) => /sent ENTER_RESPAWN_QUEUE/.test(String(line))));
});

test('a match request prefers the player-hosted connection, as the game does', async () => {
  const { game, net, names, sent, connection } = await wiredGame();
  net[names.p2pConn] = connection('host');
  game.run('wire enter_respawn_queue');
  assert.equal(sent[0]?.args[0], 'host');
});

test('an explosion is a request too: one victim group per target, yourself left out', async () => {
  const { game, placeholder, sent } = await wiredGame();
  game.run('wire_radius 1000');
  game.run('wire damage_players_via_explosion');
  assert.equal(game.log.net.length, 0);
  const args = sent[0]?.args ?? [];
  assert.strictEqual(args[2], placeholder, 'the reply placeholder is the first part');
  const victims = [args[3], args[3 + 14]];
  assert.deepEqual(victims, ['n1', 'n2'], 'bob and bluebot, not you (#0)');
  assert.equal(args.length, 3 + 14 * 2, 'two groups of 14');
});

test('aim, near and area never pick you unless you name yourself', async () => {
  const { game } = await wiredGame();
  game.run('wire_radius 100000');
  assert.ok(game.run('wire heal_player --dry').some((line) => /target -> #1 bob/.test(String(line))));
  assert.ok(game.run('wire heal_player target=near --dry').some((line) => /target -> #1 bob/.test(String(line))), 'near is the closest other character');
  assert.ok(game.run('wire heal_player target=me --dry').some((line) => /target -> #0 you/.test(String(line))));
});

test('outside a level a lobby target needs an auth id instead of crashing', async () => {
  const { game } = await wiredGame();
  game.chars.length = 0;
  assert.match(errorsOf(game.run('wire report_user'))[0] ?? '', /needs a level.*auth id/);
  assert.ok(game.run('wire report_user target=777 --dry').some((line) => /"777"/.test(String(line))));
});
