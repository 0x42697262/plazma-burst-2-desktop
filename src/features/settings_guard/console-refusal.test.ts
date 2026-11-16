import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

const SAVE_SETTLES_MS = 400;
const FORBIDDEN = 403;
const REFUSAL = 'Settings not saved: a command that runs code or acts as you was refused (settings_guard).';

const answer = (status: number, body: string) => ({ status, ok: status < FORBIDDEN, text: async () => body, json: async () => JSON.parse(body) as unknown });

test('a refused save is said in the console, and the bind is dropped back to what the file holds', async () => {
  const game = await bootConsole();
  let file = JSON.stringify({ binds: { g: 'tp' } });
  Reflect.set(globalThis, 'fetch', async (_input: string, init: { method?: string; body?: string } = {}) => {
    if (init.method !== 'PUT') return answer(200, file);
    if (init.body?.includes('js 1')) return answer(FORBIDDEN, REFUSAL);
    file = init.body ?? file;
    return answer(200, 'ok');
  });
  game.run('bind f js 1');
  await new Promise((resolve) => { setTimeout(resolve, SAVE_SETTLES_MS); });
  assert.ok(game.log.printed.some((line) => line.includes(REFUSAL)), game.log.printed.join('\n'));
  assert.ok(!game.run('bind').some((line) => /\bjs 1\b/.test(line)), 'the refused bind is gone');
  assert.ok(!file.includes('js 1'), 'and never reached the file');
  game.run('bind h heal');
  await new Promise((resolve) => { setTimeout(resolve, SAVE_SETTLES_MS); });
  assert.ok(file.includes('heal'), 'a harmless bind is saved as before');
});
