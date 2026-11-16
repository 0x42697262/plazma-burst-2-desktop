import { test } from 'node:test';
import assert from 'node:assert/strict';
import { oncePerKeyAtATime, onceUntilItFails } from './single-flight.ts';

test('a second call for the same key while the first runs shares it; another key runs on its own; afterwards it runs again', async () => {
  const started: string[] = [];
  let finish: () => void = () => undefined;
  const run = oncePerKeyAtATime((key: string) => {
    started.push(key);
    return key === 'slow' ? new Promise<void>((resolve) => { finish = resolve; }) : Promise.resolve();
  });
  const first = run('slow');
  const second = run('slow');
  await run('fast');
  assert.deepEqual(started, ['slow', 'fast']);
  finish();
  await Promise.all([first, second]);
  const again = run('slow');
  finish();
  await again;
  assert.deepEqual(started, ['slow', 'fast', 'slow']);
});

test('a failed call is not shared with the next one', async () => {
  let calls = 0;
  const run = oncePerKeyAtATime(async () => { calls++; throw new Error('no'); });
  await assert.rejects(run('a'));
  await assert.rejects(run('a'));
  assert.equal(calls, 2);
});

test('done once: every caller waits for the same run, even one that comes before it ends; a failure lets the next call try again', async () => {
  let calls = 0;
  let fail = true;
  const install = onceUntilItFails(async () => {
    calls++;
    await Promise.resolve();
    if (fail) throw new Error('not yet');
  });
  await assert.rejects(Promise.all([install(), install()]));
  assert.equal(calls, 1);
  fail = false;
  await Promise.all([install(), install()]);
  await install();
  assert.equal(calls, 2);
});
