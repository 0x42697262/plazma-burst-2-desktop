import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const ID = 'abc12.def34.ghi56.jkl78';
const settled = () => new Promise((resolve) => { setImmediate(resolve); });
const HOUR = 3600000;

async function deviceGame(save: Record<string, unknown> | null, seen: unknown) {
  const game = await bootConsole();
  if (save) game.globals.localStorage.setItem('plazma_burst2', JSON.stringify(save));
  else game.globals.localStorage.removeItem('plazma_burst2');
  game.globals.fetch = (url: string) => (String(url).endsWith('/device') && seen
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(seen) })
    : Promise.reject(new Error('no wrapper')));
  game.log.printed.length = 0;
  game.run('rep device');
  await settled();
  await settled();
  return game.log.printed.map(String);
}

test('rep device shows the id, its shape, the first account, and that it came with a network save', async () => {
  const now = Date.now();
  const lines = await deviceGame({ first_uid: ID, first_login: 'player-one', first_login_proof: 'p', volume: 1 }, {
    loads: [{ at: now - 2 * HOUR, login: 'player-one', uid: ID, firstLogin: 'player-one', hasProof: true }],
    uploads: [{ at: now - HOUR, login: 'player-two', uid: ID, firstLogin: 'player-one', hasProof: true }],
  });
  const text = lines.join('\n');
  assert.ok(lines.includes(`Device id: ${ID}`), text);
  assert.match(text, /four random base-36 numbers/);
  assert.ok(lines.includes('First account on this save: player-one (its login proof is kept)'), text);
  assert.match(text, /2h 0m ago: player-one's network save was loaded at start and carried this id/);
  assert.match(text, /1h 0m ago: uploaded with player-two's network save, so that account carries this id from now on/);
  assert.ok(!text.includes('"p"') && !/proof: p\b/.test(text), 'the proof itself is never shown');
});

test('rep device explains a kept id, another shape, no id, and no record', async () => {
  const now = Date.now();
  const kept = (await deviceGame({ first_uid: 'l0.123456789' }, { loads: [{ at: now, login: 'player-one', uid: null, firstLogin: null, hasProof: false }], uploads: [] })).join('\n');
  assert.match(kept, /not the way this game version makes one/);
  assert.match(kept, /carried no id, so this one was already in this install's save/);
  assert.match(kept, /First account on this save: none yet/);
  const none = (await deviceGame(null, { loads: [], uploads: [] })).join('\n');
  assert.match(none, /Device id: none yet/);
  assert.match(none, /No network save was loaded in this session/);
  const noWrapper = (await deviceGame({ first_uid: ID }, null)).join('\n');
  assert.match(noWrapper, /record of network saves is not available/);
});

test('rep device takes no arguments', async () => {
  const game = await bootConsole();
  assert.match(errorsOf(game.run('rep device now'))[0] ?? '', /usage: rep device/);
});
