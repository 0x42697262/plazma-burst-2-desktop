import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newRiskyCommands } from './domain/risky.ts';
import { settingsGuardInterceptor } from './entry/interceptor.ts';

const PUT = (body: unknown): Request => new Request('https://www.plazmaburst2.com/h5/versions/v1/__dev/kv', { method: 'PUT', body: JSON.stringify(body) });

test('a bind, a profile bind or a profile onload that runs js, wire, game, servers or diagnostics is new and risky', () => {
  const previous = { binds: { f: 'tp', g: 'js 1' } };
  const next = {
    binds: { f: 'tp', g: 'js 1', h: 'heal; JS alert(1)', k: '  wire hit_player', n: 'give 3' },
    profiles: { pvp: { binds: { x: 'game kick' }, onload: 'god on; servers connect official' }, calm: { speed: 2 } },
  };
  assert.deepEqual(newRiskyCommands(previous, next), [
    { where: 'bind h', command: 'heal; JS alert(1)' },
    { where: 'bind k', command: 'wire hit_player' },
    { where: 'profile pvp bind x', command: 'game kick' },
    { where: 'profile pvp onload', command: 'god on; servers connect official' },
  ]);
});

test('an onload given as a list of commands is checked like the console reads it, joined', () => {
  assert.deepEqual(newRiskyCommands({}, { profiles: { x: { onload: ['god on', 'js alert(1)'] } } }), [{ where: 'profile x onload', command: 'god on; js alert(1)' }]);
  assert.deepEqual(newRiskyCommands({ profiles: { x: { onload: 'god on; js alert(1)' } } }, { profiles: { x: { onload: ['god on', 'js alert(1)'] } } }), [], 'the same commands, written as a list: not new');
  assert.deepEqual(newRiskyCommands({}, { profiles: { x: { onload: ['god on', 3] } } }), [], 'a list the console refuses is not run, so not asked about');
});

test('nothing new, a changed harmless command, a removed one, or a broken file is not risky', () => {
  assert.deepEqual(newRiskyCommands({ binds: { g: 'js 1' } }, { binds: { g: 'js 1' } }), []);
  assert.deepEqual(newRiskyCommands({ binds: { g: 'js 1' } }, { binds: {} }), []);
  assert.deepEqual(newRiskyCommands({}, { binds: { g: 'jsx 1', h: 'json' } }), []);
  assert.deepEqual(newRiskyCommands({}, { binds: 'nope', profiles: [1] }), []);
  assert.deepEqual(newRiskyCommands({ binds: { g: 'js 1' } }, { binds: { h: 'js 1' } }), [{ where: 'bind h', command: 'js 1' }], 'moved to another key: asked again');
});

function guardWith(answer: boolean, file: Record<string, unknown> = {}, remote = false) {
  const asked: string[][] = [];
  const intercept = settingsGuardInterceptor({ confirm: async (commands) => { asked.push(commands.map((entry) => `${entry.where}: ${entry.command}`)); return answer; } });
  const context = { remote, kvFile: { read: async () => JSON.stringify(file) } };
  const call = (request: Request) => intercept(request, new URL(request.url), context);
  return { asked, call };
}

test('a save that adds a risky command waits for your answer: yes lets it through, no refuses it', async () => {
  const yes = guardWith(true);
  assert.equal(await yes.call(PUT({ binds: { f: 'js 1' } })), null);
  assert.deepEqual(yes.asked, [['bind f: js 1']]);
  const no = guardWith(false);
  const refused = await no.call(PUT({ binds: { f: 'js 1' } }));
  assert.equal(refused?.status, 403);
  assert.match(await refused?.text() ?? '', /not saved/);
});

test('harmless saves, reads and other routes are left alone, and nobody is asked', async () => {
  const guard = guardWith(false, { binds: { g: 'js 1' } });
  assert.equal(await guard.call(PUT({ binds: { g: 'js 1', f: 'tp' } })), null);
  assert.equal(await guard.call(new Request('https://www.plazmaburst2.com/h5/versions/v1/__dev/kv')), null);
  assert.equal(await guard.call(new Request('https://www.plazmaburst2.com/h5/versions/v1/__dev/other', { method: 'PUT', body: '{"binds":{"f":"js 1"}}' })), null);
  assert.deepEqual(guard.asked, []);
});

test('a remote tester\'s page cannot add one: refused without asking the host', async () => {
  const guard = guardWith(true, {}, true);
  assert.equal((await guard.call(PUT({ binds: { f: 'js 1' } })))?.status, 403);
  assert.deepEqual(guard.asked, []);
});
