import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, resolveMessage } from './parse.ts';

test('resolveMessage: exact, reliable_ prefix optional, unique prefix, errors', () => {
  assert.equal(resolveMessage('hit_player').name, 'HIT_PLAYER');
  assert.equal(resolveMessage('HIT_PLAYER').name, 'HIT_PLAYER');
  assert.equal(resolveMessage('reliable_hit_player').name, 'HIT_PLAYER');
  assert.equal(resolveMessage('heal').name, 'HEAL_PLAYER');
  assert.throws(() => resolveMessage('nope'), /not a message/);
  assert.throws(() => resolveMessage('ai_'), /more than one message/);
});

test('parseArgs: key=value, positional in order skipping the reply id, flags', () => {
  const parsed = parseArgs(['heal_player', 'target=bob', 'power=5']);
  assert.equal(parsed.message.name, 'HEAL_PLAYER');
  assert.equal(parsed.assignments.get('target'), 'bob');
  assert.equal(parsed.assignments.get('power'), '5');

  const positional = parseArgs(['join_match', '52099', '-100', '1']);
  assert.equal(positional.assignments.get('uid'), '52099');
  assert.equal(positional.assignments.get('slot'), '-100');
  assert.equal(positional.assignments.get('wantmap'), '1');
  assert.equal(positional.assignments.has('reply'), false, 'the reply id is skipped by positional fill');

  const flags = parseArgs(['authenticate', '--dry', '--force']);
  assert.equal(flags.flags.dry, true);
  assert.equal(flags.flags.force, true);
  assert.equal(flags.flags.raw, false);
});

test('parseArgs: unknown field, unknown flag and too many values are errors', () => {
  assert.throws(() => parseArgs(['heal_player', 'nope=1']), /no field "nope"/);
  assert.throws(() => parseArgs(['heal_player', '--bogus']), /not a flag/);
  assert.throws(() => parseArgs(['var_sync', 'a', 'b', 'c', 'd']), /positional value/);
});
