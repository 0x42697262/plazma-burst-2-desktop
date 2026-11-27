import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const ID = 'abc12.def34.ghi56.jkl78';
const SITE = 'https://www.plazmaburst2.com/pb2/server.php';
const settled = async () => { for (let round = 0; round < 4; round++) await new Promise((resolve) => { setImmediate(resolve); }); };

type Asked = { action: string; url: string; login: string; password: string; text: string };

async function saveGame({ local = { volume: 1, first_uid: ID, first_login: 'player-one', first_login_proof: 'secret-proof' }, online = `volume=0.5;first_uid=${ID};only_online=1;first_login_proof=other-proof;`, login = 'player-one', lobby = 'player-one', skipsUpload = false } = {}) {
  const game = await bootConsole();
  const { globals, names } = game;
  const data: Record<string, unknown> = { ...local };
  const flushed: string[] = [];
  globals[names.gameSave] = { data, flush: () => { flushed.push(JSON.stringify(data)); } };
  globals[names.saveUrl] = SITE;
  globals[names.saveText] = (withDevice: boolean) => Object.entries(data).filter(([name]) => withDevice || !name.startsWith('first_')).map(([name, value]) => `${name}=${String(value)};`).join('');
  globals.loaderInfo = { parameters: { l: login, p: 'the-password' } };
  const gameUploadsSeen: unknown[] = [];
  const uploadCalls: number[] = [];
  globals[names.saveUpload] = () => { uploadCalls.push(1); if (!skipsUpload) gameUploadsSeen.push({ at: Date.now(), login, source: 'game', uid: ID, firstLogin: login, hasProof: true }); };
  globals[names.net][names.connUser] = { login: lobby };
  const asked: Asked[] = [];
  globals.fetch = async (url: string, init?: { body?: string }) => {
    if (String(url).endsWith('/netsaves')) return { ok: true, json: async () => ({ loads: [{ at: Date.now() - 60000, login, source: 'game', uid: ID, firstLogin: login, hasProof: true }], uploads: [...gameUploadsSeen] }) };
    if (String(url).endsWith('/netsave')) {
      const body = JSON.parse(init?.body ?? '{}') as Asked;
      asked.push(body);
      return { ok: true, json: async () => ({ status: 200, text: body.action === 'load' ? online : '' }) };
    }
    throw new Error('unexpected fetch');
  };
  const lines = async (line: string): Promise<string[]> => {
    game.log.printed.length = 0;
    game.run(line);
    await settled();
    return game.log.printed.map(String);
  };
  return { game, data, flushed, asked, lines, uploadCalls };
}

test('netsave shows the page\'s account, the local save and what was seen; a lobby login on another account is a warning', async () => {
  const same = await saveGame();
  const text = (await same.lines('netsave')).join('\n');
  assert.match(text, /Network save of: player-one \(the page's login/);
  assert.match(text, /Local save: 4 values/);
  assert.match(text, /game download for player-one, with a device id/);
  assert.doesNotMatch(text, /the-password|secret-proof/);
  const other = await saveGame({ lobby: 'player-two' });
  assert.match((await other.lines('netsave')).join('\n'), /The lobby is logged in as player-two, but uploads go to player-one/);
});

test('netsave preview lists what the next upload sends, the proof hidden, and --raw the text', async () => {
  const { lines } = await saveGame();
  const rows = await lines('netsave preview');
  assert.ok(rows.includes('The next upload to player-one would send 4 values, 97 characters:'), rows.join('\n'));
  assert.ok(rows.includes('  first_login_proof = ‹hidden›'));
  assert.ok(rows.includes(`  first_uid = ${ID}`));
  const raw = (await lines('netsave preview --raw')).join('\n');
  assert.match(raw, /first_login_proof=‹hidden›;/);
  assert.doesNotMatch(raw, /secret-proof/);
});

test('netsave download asks the site through the app and writes nothing', async () => {
  const { lines, asked, flushed, data } = await saveGame();
  const rows = await lines('netsave download');
  assert.deepEqual(asked, [{ action: 'load', url: SITE, login: 'player-one', password: 'the-password', text: '' }]);
  assert.ok(rows.some((line) => /player-one's network save: 4 values/.test(line)), rows.join('\n'));
  assert.ok(rows.includes('  only_online = 1'));
  assert.ok(!rows.join('\n').includes('other-proof'));
  assert.equal(flushed.length, 0);
  assert.equal(data.volume, 1);
});

test('netsave diff compares the two sides', async () => {
  const { lines } = await saveGame();
  const rows = await lines('netsave diff');
  assert.ok(rows.includes('1 the same, 2 differ, 1 only local, 1 only online'), rows.join('\n'));
  assert.ok(rows.includes('  volume: 1 -> 0.5'));
  assert.ok(rows.includes('  first_login_proof: ‹hidden› -> ‹hidden›'));
});

test('without a login there is no network save, the site saying none is shown, and arguments are checked', async () => {
  const loggedOut = await saveGame({ login: '' });
  assert.match((await loggedOut.lines('netsave download')).join('\n'), /not logged in/);
  assert.equal(loggedOut.asked.length, 0);
  const empty = await saveGame({ online: 'x' });
  assert.match((await empty.lines('netsave download')).join('\n'), /player-one has no network save on the site \(it answered "x"\)/);
  assert.match(errorsOf(empty.game.run('netsave preview now'))[0] ?? '', /usage: netsave preview/);
});

const afterUploadWait = async (game: { run(line: string): unknown; log: { printed: unknown[] } }, line: string): Promise<string> => {
  game.log.printed.length = 0;
  game.run(line);
  await new Promise((resolve) => { setTimeout(resolve, 1700); });
  return game.log.printed.map(String).join('\n');
};

test('netsave upload says what it would do; with --yes it runs the game\'s upload and tells whether the game sent it', async () => {
  const { game, lines, uploadCalls } = await saveGame({ lobby: 'player-two' });
  const told = (await lines('netsave upload')).join('\n');
  assert.match(told, /would overwrite player-one's network save with 4 values/);
  assert.match(told, /The lobby is logged in as player-two; the upload goes to player-one/);
  assert.equal(uploadCalls.length, 0, 'nothing without --yes');
  assert.match(await afterUploadWait(game, 'netsave upload --yes'), /The game uploaded the save to player-one's network save/);
  assert.equal(uploadCalls.length, 1);
  const skipping = await saveGame({ skipsUpload: true });
  assert.match(await afterUploadWait(skipping.game, 'netsave upload --yes'), /The game did not upload: it skips while a level is being played/);
});

test('netsave upload --direct sends the save text through the app, whatever the game is doing', async () => {
  const { lines, asked, uploadCalls } = await saveGame({ skipsUpload: true });
  assert.match((await lines('netsave upload --direct')).join('\n'), /sent directly through the desktop app\.[\s\S]*netsave upload --direct --yes/);
  assert.equal(asked.length, 0);
  const done = (await lines('netsave upload --yes --direct')).join('\n');
  assert.match(done, /Sent 4 values to player-one's network save directly; the site answered HTTP 200/);
  assert.equal(asked[0]?.action, 'save');
  assert.match(asked[0]?.text ?? '', /first_uid=abc12\.def34\.ghi56\.jkl78;/);
  assert.equal(uploadCalls.length, 0, 'not the game\'s upload');
});
