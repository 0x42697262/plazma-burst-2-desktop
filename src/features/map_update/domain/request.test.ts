import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatRequest, terminalRequest } from './request.ts';

test('terminal: a map ID or a #match, then an optional "now"; anything else is the usage', () => {
  assert.deepEqual(terminalRequest('update author-arena'), { target: { kind: 'map', id: 'author-arena' }, now: false });
  assert.deepEqual(terminalRequest('update #2 now'), { target: { kind: 'match', word: '2' }, now: true });
  assert.deepEqual(terminalRequest('UPDATE 2 NOW'), { target: { kind: 'map', id: '2' }, now: true }, 'without # a number is a map ID');
  for (const wrong of ['', 'update', 'update now', 'refresh x', 'update a b', 'update # now', 'update a now later']) assert.equal(terminalRequest(wrong), null, wrong);
});

test('chat: only the command itself, with or without "now"', () => {
  assert.deepEqual(chatRequest('-mapupdate'), { now: false });
  assert.deepEqual(chatRequest('  -MapUpdate   now '), { now: true });
  for (const other of ['mapupdate', '-mapupdate later', '-mapupdates', 'hi -mapupdate', '']) assert.equal(chatRequest(other), null, other);
});
