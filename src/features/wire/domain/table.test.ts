import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSAGES, MESSAGE_BY_NAME } from './constants.ts';
import { CHANNEL } from '../keys.ts';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const protocol = (): string => fs.readFileSync(path.join(REPO, 'docs/research/protocol.md'), 'utf8');

test('the table lists every opcode in docs/research/protocol.md, in order', () => {
  const rows = [...protocol().matchAll(/^\| (\d+) \| `([A-Z_]+)` \|/gm)];
  const inDoc = rows.map((row) => row[2]);
  assert.equal(inDoc.length, MESSAGES.length, 'same number of messages as the doc opcode table');
  assert.deepEqual(MESSAGES.map((message) => message.name), inDoc, 'same names in the same order');
  assert.equal(MESSAGE_BY_NAME.size, MESSAGES.length, 'no duplicate names');
});

test('sendable matches direction, and only sendable messages have fields', () => {
  for (const message of MESSAGES) {
    const clientOriginated = message.direction.startsWith('client');
    assert.equal(message.sendable, clientOriginated, `${message.name} sendable flag matches its direction`);
    if (!message.sendable) assert.equal(message.fields.length, 0, `${message.name} is receive-only and carries no send fields`);
  }
});

test('every field names a channel-consistent reply and known scale', () => {
  for (const message of MESSAGES) {
    assert.ok(message.channel === CHANNEL.match || message.channel === CHANNEL.lobby);
    for (const field of [...message.fields, ...(message.group ?? [])]) {
      if (field.scale !== undefined) assert.ok(field.scale > 0, `${message.name}.${field.name} has a positive scale`);
    }
  }
});
