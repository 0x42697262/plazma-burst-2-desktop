import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSmokeArgs, stopGroup } from './args.ts';

test('the arguments: commands, client, level and Electron\'s own; a missing client is the official one', () => {
  assert.deepEqual(parseSmokeArgs(['--run', 'help', '--run', 'pos', '--', '--ozone-platform=headless']), { client: 'official', levelFile: null, commands: ['help', 'pos'], electronArgs: ['--ozone-platform=headless'], problem: null });
  assert.deepEqual(parseSmokeArgs(['--client', 'sadburst', '--run', 'guns']).client, 'sadburst');
  assert.equal(parseSmokeArgs(['--level', 'data/maps/a.xml']).levelFile, 'data/maps/a.xml');
});

test('an unknown client, a flag with no value, or a level outside the official client is a problem', () => {
  assert.match(parseSmokeArgs(['--client', 'flash']).problem ?? '', /unknown client "flash"/);
  assert.match(parseSmokeArgs(['--client']).problem ?? '', /--client needs a value/);
  assert.match(parseSmokeArgs(['--level']).problem ?? '', /--level needs a value/);
  assert.match(parseSmokeArgs(['--client', 'sadburst', '--level', 'a.xml']).problem ?? '', /official client only/);
});

test('stopping a group that is already gone is not an error; any other failure is', () => {
  const gone = Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
  assert.doesNotThrow(() => { stopGroup(12, () => { throw gone; }); });
  assert.throws(() => { stopGroup(12, () => { throw Object.assign(new Error('kill EPERM'), { code: 'EPERM' }); }); }, /EPERM/);
  const killed: number[] = [];
  stopGroup(12, (pid) => { killed.push(pid); });
  stopGroup(undefined, (pid) => { killed.push(pid); });
  assert.deepEqual(killed, [-12]);
});
