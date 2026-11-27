import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDeviceId } from './device-id.ts';

test('a new device id is four base-36 numbers joined by dots, as the game makes one', () => {
  assert.match(newDeviceId(), /^[0-9a-z]+(\.[0-9a-z]+){3}$/);
  assert.equal(newDeviceId(() => 0), '0.0.0.0');
  assert.notEqual(newDeviceId(), newDeviceId());
});
