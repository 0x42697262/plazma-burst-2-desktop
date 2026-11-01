import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NET_DIGITS, encNum, encSigned, netMsg } from '#console/testing/net-protocol.fixture.ts';
import { describeMessage } from './domain/message.ts';
import { redactParts } from './domain/redaction.ts';
import { describeState } from './domain/state.ts';
import { parseFilter } from './domain/filter.ts';
import { lossText, newCounts, reasonText } from './domain/loss.ts';
import { playerState, STATE_LAYOUT } from './state.fixture.ts';

const typeNames = (names: Record<number, string>) => (type: number) => names[type] ?? null;

test('a RESPONSE\'s callback ID is decoded even when it looks like a letter; JSON shows as it is', () => {
  const names = typeNames({ 0: 'RELIABLE_RESPONSE', 4: 'RELIABLE_GET_MATCH_LIST' });
  assert.equal(encNum(100), 'h', 'the callback counter starts at 100: one letter');
  assert.equal(describeMessage(netMsg(0, encNum(100), 'fail', 'Server: Unknown error [2]'), NET_DIGITS, names).text, 'RESPONSE(100, "fail", "Server: Unknown error [2]")');
  assert.equal(describeMessage(netMsg(0, encNum(101), 'ok', '[{"uid":1,"map_id":"a-b"}]'), NET_DIGITS, names).text, 'RESPONSE(101, "ok", [{"uid":1,"map_id":"a-b"}])');
  assert.equal(describeMessage(netMsg(4, 'h'), NET_DIGITS, names).text, 'GET_MATCH_LIST("h")', 'elsewhere a letter stays text');
  assert.equal(describeMessage(netMsg(77), NET_DIGITS, names).text, 'TYPE_77()');
});

test('a part over 2000 characters is cut unless the message is shown whole', () => {
  const names = typeNames({ 4: 'RELIABLE_TASK' });
  const code = '( v )=>{ return v; }'.padEnd(7370, ' ');
  assert.equal(describeMessage(netMsg(4, code, 'r'), NET_DIGITS, names).text, `TASK(${JSON.stringify(code.slice(0, 2000))}...(7370 chars), "r")`);
  assert.equal(describeMessage(netMsg(4, code, 'r'), NET_DIGITS, names, true).text, `TASK(${JSON.stringify(code)}, "r")`);
});

test('messages that carry HP or the respawn count are decoded as numbers even when a value looks like a letter', () => {
  const names = typeNames({ 7: 'RELIABLE_RESPAWN', 8: 'RELIABLE_HIT_PLAYER' });
  assert.equal(describeMessage(netMsg(7, encNum(1264), encSigned(-520), encNum(100)), NET_DIGITS, names).text, 'RESPAWN(1264, -520, 100)');
  assert.equal(describeMessage(netMsg(7, encNum(0), encNum(1264), encSigned(-520), encNum(100), encNum(40)), NET_DIGITS, names).text, 'RESPAWN(0, 1264, -520, 100, 40)');
  const sent = [3, 2, 50, 100, 1, 600, 300, 10, 0, 4, 1, 7, 2500, 40].map(encNum);
  assert.equal(describeMessage(netMsg(8, ...sent), NET_DIGITS, names).text, 'HIT_PLAYER(3, 2, 50, 100, 1, 600, 300, 10, 0, 4, 1, 7, 2500, 40)');
  assert.equal(describeMessage(netMsg(8, encNum(1), ...sent, '1'), NET_DIGITS, names).text, 'HIT_PLAYER(1, 3, 2, 50, 100, 1, 600, 300, 10, 0, 4, 1, 7, 2500, 40, "1")');
});

test('passwords are redacted: the login\'s, a match join\'s and a created match\'s; an empty one stays empty', () => {
  const names = typeNames({ 3: 'RELIABLE_AUTHENTICATE', 9: 'RELIABLE_JOIN_MATCH', 10: 'RELIABLE_CREATE_MATCH' });
  assert.equal(describeMessage(netMsg(3, 'player', 'a1b2c3', 'version_h5'), NET_DIGITS, names).text, 'AUTHENTICATE("player", "‹redacted›", "version_h5")');
  assert.equal(describeMessage(netMsg(3, '.guest', '', 'version_h5'), NET_DIGITS, names).text, 'AUTHENTICATE(".guest", "", "version_h5")');
  assert.equal(describeMessage(netMsg(9, 'ab', 'c', 'de', '1', 'matchpass'), NET_DIGITS, names).text, 'JOIN_MATCH("ab", "c", "de", "1", "‹redacted›")');
  const created = describeMessage(netMsg(10, JSON.stringify({ title: 'x', password: 'secret' }), 'r'), NET_DIGITS, names).text;
  assert.equal(created, 'CREATE_MATCH({"title":"x","password":"‹redacted›"}, "r")');
  assert.equal(describeMessage(netMsg(10, JSON.stringify({ title: 'x', password: '' }), 'r'), NET_DIGITS, names).text, 'CREATE_MATCH({"title":"x","password":""}, "r")');
  assert.deepEqual(redactParts('CHAT', ['a', 'b']), ['a', 'b']);
  assert.deepEqual(redactParts('CREATE_MATCH', ['t', 'not json']), ['t', 'not json']);
  assert.ok(!describeMessage(netMsg(3, 'player', 'a1b2c3'), NET_DIGITS, names).text.includes('a1b2c3'));
  assert.deepEqual(describeMessage(netMsg(3, 'player', 'a1b2c3'), NET_DIGITS, names).parts.slice(1), ['player', 'a1b2c3'], 'callbacks still match the parts as sent');
});

test('a state update is decoded by position, numbers that look like letters included (HP 100 is "h")', () => {
  const parts = playerState();
  assert.equal(parts[6], 'h', 'HP 100 travels as one letter');
  assert.equal(describeState(parts.join('\x02'), NET_DIGITS, 'player', STATE_LAYOUT),
    'hp 100 | respawns 1 | aim +212,-40 | pos 1264,-520 | vel 0,0 | body hp: head 60 face 90 arms 60 legs 75 | gun 2 | clock 52.310 s');
  const dead = playerState({ hp: 0 });
  dead[16] = encNum(3);
  assert.match(describeState(dead.join('\x02'), NET_DIGITS, 'player', STATE_LAYOUT), /^hp 0 \| .* \| killed by 3 \|/);
  const relayed = playerState({ hp: '' });
  const snapshot = [encNum(12000), encNum(3), encNum(80), `${encNum(45)}~${encNum(123)}~${encNum(10)}`, encNum(relayed.length), ...relayed,
    encNum(5), encNum(150), `${encNum(60)}~${encNum(100)}~${encNum(0)}`, encNum(0)];
  assert.equal(describeState(snapshot.join('\x02'), NET_DIGITS, 'snapshot', STATE_LAYOUT),
    'round timer 12.0 s | #3 hp 80 ping 45 ms [hp - | respawns 1 | aim +212,-40 | pos 1264,-520 | vel 0,0 | body hp: head 60 face 90 arms 60 legs 75 | gun 2 | clock 52.310 s] | #5 hp 150 ping 60 ms');
  assert.equal(describeState(['x', 'y'].join('\x02'), NET_DIGITS, 'snapshot', STATE_LAYOUT), '("x", "y")');
});

test('a new game version: the server\'s positions come from the game, the rest is not guessed', () => {
  const parts = playerState();
  parts.splice(6, 0, encNum(7));
  const moved = { ...STATE_LAYOUT, hp: 7, aimX: 8, aimY: 9, headHp: 13, faceHp: 14, killer: 17, clock: 20, respawns: 21 };
  assert.match(describeState(parts.join('\x02'), NET_DIGITS, 'player', moved),
    /^hp 100 \| respawns 1 \| aim \+212,-40 \| pos 1264,-520 \| head hp 60, face hp 90 \| clock 52\.310 s \| \(22 parts; not this version's layout: only the server's positions are named\), p6 7, /);
  assert.doesNotMatch(describeState(playerState().join('\x02'), NET_DIGITS, 'player', { ...STATE_LAYOUT, hp: null }), /hp 100/);
});

test('the show filter: direction, kinds, type, connection, words and last', () => {
  const lines = [
    '05:31:01.000  c1 server     OUT  REL    #0 CHAT("hello")',
    '05:31:02.000  c1 server     IN   LOSS   gap: #2 arrived before #1',
    '05:31:03.000  c2 p2p-host   IN   REL    #4 SHOT(3)',
    'a line in no known format',
  ];
  const pick = (args: string[]) => lines.filter(parseFilter(args).test);
  assert.equal(pick(['--out']).length, 1);
  assert.equal(pick(['--loss']).length, 1);
  assert.equal(pick(['type:shot']).length, 1);
  assert.equal(pick(['type:reliable_chat']).length, 1);
  assert.equal(pick(['conn:p2p']).length, 1);
  assert.equal(pick(['format']).length, 1);
  assert.equal(pick([]).length, 4);
  assert.equal(parseFilter(['last:5']).last, 5);
  assert.equal(parseFilter(['run:2']).run, '2');
  assert.throws(() => parseFilter(['--in', '--out']), /do not go together/);
  assert.throws(() => parseFilter(['last:0']), /a whole number from 1 to 20000/);
  assert.throws(() => parseFilter(['type:']), /type: needs a value, e\.g\. type:chat/);
});

test('losses and close reasons in words', () => {
  assert.equal(lossText(newCounts()), 'none');
  assert.equal(lossText({ ...newCounts(), slow: 2, late: 1 }), '2 slow acks, 1 late');
  assert.equal(reasonText(null), 'no reason given');
  assert.equal(reasonText('ping timeout'), 'ping timeout (the server stopped answering socket.io\'s heartbeat)');
  assert.equal(reasonText('something else'), 'something else');
});
