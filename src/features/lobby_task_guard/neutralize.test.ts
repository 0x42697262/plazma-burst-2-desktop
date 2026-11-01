import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NET_DIGITS, encNum, netMsg, netPacket } from '#console/testing/net-protocol.fixture.ts';
import { splitParts, unescField } from '#console/kernel/net/codec.ts';
import { neutralizeTasks } from './domain/neutralize.ts';

const names = (type: number) => ({ 5: 'RELIABLE_CHAT', 46: 'RELIABLE_TASK', 47: 'RELIABLE_TASK_ASNYC' } as Record<number, string>)[type] ?? null;

test('a task\'s code becomes a function that does nothing; everything else in the packet stays as sent', () => {
  const packet = netPacket(7, 'state', [[3, netMsg(5, 'hi there')], [4, netMsg(46, 'alert(document.cookie)', encNum(110))], [5, netMsg(47, '(v,a)=>a(1)', encNum(111))]]);
  const { text, replaced } = neutralizeTasks(packet, NET_DIGITS, names);
  assert.equal(replaced, 2);
  const fields = text.split('\x01');
  assert.deepEqual(fields.slice(0, 3), ['7', 'state', '3']);
  assert.deepEqual(splitParts(unescField(fields[3] ?? '')), [encNum(5), 'hi there']);
  assert.deepEqual(splitParts(unescField(fields[5] ?? '')), [encNum(46), '()=>undefined', encNum(110)]);
  assert.deepEqual(splitParts(unescField(fields[7] ?? '')), [encNum(47), '()=>undefined', encNum(111)]);
  const untouched = netPacket(1, '', [[0, netMsg(5, 'only chat')]]);
  assert.deepEqual(neutralizeTasks(untouched, NET_DIGITS, names), { text: untouched, replaced: 0 });
});
