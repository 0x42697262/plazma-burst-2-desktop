import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const row = (lines: readonly string[], field: string): string => lines.filter((line) => !String(line).includes('->')).find((line) => String(line).trimStart().startsWith(field + ' ')) ?? '';

test('wire --dry scales game units and resolves a named target', async () => {
  const game = await bootConsole();
  game.chars[1].auth_id = 12345;
  const lines = game.run('wire heal_player target=bob power=5 --dry');
  assert.ok(lines.some((line) => /target -> #1 bob/.test(String(line))), 'prints who it picked');
  assert.match(row(lines, 'power'), /power\s+5\s+500\s+\(x100\)/, 'power 5 -> 500 on the wire');
  assert.match(row(lines, 'target'), /target\s+#1 bob\s+1/, 'target resolves to slot 1');
});

test('wire uses the crosshair for a missing target, within wire_radius', async () => {
  const game = await bootConsole();
  game.run('wire_radius 1000');
  const lines = game.run('wire hit_player --dry');
  assert.ok(lines.some((line) => /victim -> #/.test(String(line))), 'aim picked a victim');
  game.run('wire_radius 1');
  assert.match(errorsOf(game.run('wire hit_player'))[0] ?? '', /matched nobody/);
});

test('wire raw: and --raw skip scaling', async () => {
  const game = await bootConsole();
  game.run('wire_radius 1000');
  assert.match(row(game.run('wire hit_player power=raw:350 --dry'), 'power'), /power\s+raw:350\s+350/);
  assert.match(row(game.run('wire hit_player power=3.5 --raw --dry'), 'power'), /power\s+3\.5\s+4/, '--raw rounds, no x100');
});

test('wire resolves an auth id for report/kick, or takes one directly', async () => {
  const game = await bootConsole();
  game.chars[1].auth_id = 12345;
  assert.match(row(game.run('wire report_user target=bob --dry'), 'target'), /"12345"/);
  assert.match(row(game.run('wire report_user target=777 --dry'), 'target'), /"777"/);
});

test('wire var_sync sends mode, name and value as text', async () => {
  const game = await bootConsole();
  const lines = game.run('wire var_sync r door_1 1 --dry');
  assert.match(row(lines, 'mode'), /mode\s+r\s+"r"/);
  assert.match(row(lines, 'value'), /value\s+1\s+"1"/);
});

test('wire refuses a receive-only message and an unknown one', async () => {
  const game = await bootConsole();
  assert.match(errorsOf(game.run('wire task'))[0] ?? '', /not something a client sends/);
  assert.match(errorsOf(game.run('wire nope'))[0] ?? '', /not a message/);
  assert.match(errorsOf(game.run('wire heal_player nope=1'))[0] ?? '', /no field "nope"/);
});

test('wire authenticate needs --force', async () => {
  const game = await bootConsole();
  assert.match(errorsOf(game.run('wire authenticate'))[0] ?? '', /--force/);
  assert.ok(game.run('wire authenticate --force --dry').some((line) => /would send/.test(String(line))));
});

test('wire list shows all messages and marks the receive-only ones', async () => {
  const game = await bootConsole();
  const lines = game.run('wire list');
  assert.equal(lines.length, 44);
  assert.ok(lines.some((line) => /hit_player\s+client ->/.test(String(line))));
  assert.ok(lines.some((line) => /task\s+.*\[receive only\]/.test(String(line))));
});

test('wire help lists a message\'s fields with units and defaults', async () => {
  const game = await bootConsole();
  const lines = game.run('wire help hit_player');
  assert.ok(lines.some((line) => /^hit_player/.test(String(line))));
  assert.match(row(lines, 'power'), /power\s+number x100\s+0\s+gun power, e\.g\. 3\.5\s+projectile power/);
  assert.match(row(lines, 'victim'), /victim\s+player\s+aim\s+#n, name, me, ally, enemy\s+the victim slot/);
});

test('wire help says what the message does, has a column header and readable defaults', async () => {
  const game = await bootConsole();
  const lines = game.run('wire help hit_player').map(String);
  assert.ok(lines.some((line) => /Reports a projectile hitting a player/.test(line)), 'a description of the message');
  const header = lines.findIndex((line) => /^\s+field\s+type\s+default\s+what to put\s+meaning$/.test(line));
  assert.ok(header > 0, 'a column header');
  assert.ok(lines.findIndex((line) => /^\s+victim\s/.test(line)) > header, 'the header comes before the fields');
  const text = lines.join('\n');
  for (const internal of ['myPosX', 'myPosY', 'myGun', 'targetRespawns', 'replyId', 'zero']) assert.ok(!text.includes(internal), `${internal} is shown as words`);
  assert.match(text, /x\s+number\s+your x\s+a number\s+hit x/);
  assert.match(text, /respawns\s+number\s+target's count/);
  assert.match(text, /xN: you type game units/);
});

test('wire help marks a field with no default as required and lists the choices', async () => {
  const game = await bootConsole();
  const text = game.run('wire help get_match_list').map(String).join('\n');
  assert.match(text, /view\s+choice\s+required\s+match_list, relations, skill_board\s+which list/);
  assert.match(text, /reply\s+text\s+\(automatic\)/);
  assert.ok(!/xN:/.test(text), 'no unit line when nothing is scaled');
});

test('wire help on a message with no fields has no column header, and a receive-only one gives its reason', async () => {
  const game = await bootConsole();
  const sword = game.run('wire help sword_attack').map(String).join('\n');
  assert.ok(!/field\s+type\s+default/.test(sword));
  assert.match(sword, /Plays a sword swing/);
  assert.match(game.run('wire help task').map(String).join('\n'), /note: the server sends this to clients/);
});
