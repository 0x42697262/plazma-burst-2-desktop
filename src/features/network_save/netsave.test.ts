import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

const ID = 'abc12.def34.ghi56.jkl78';
const SITE = 'https://www.plazmaburst2.com/pb2/server.php';
const settled = async () => { for (let round = 0; round < 30; round++) await new Promise((resolve) => { setImmediate(resolve); }); };

type Asked = { action: string; url: string; login: string; password: string; text: string };

async function saveGame({ local = { volume: 1, first_uid: ID, first_login: 'player-one', first_login_proof: 'secret-proof' }, online = `volume=0.5;first_uid=${ID};only_online=1;first_login_proof=other-proof;`, login = 'player-one', lobby = 'player-one', skipsUpload = false } = {}) {
  const game = await bootConsole();
  const { globals, names } = game;
  const data: Record<string, unknown> = { ...local };
  const flushed: string[] = [];
  globals[names.gameSave] = { data, flush: () => { flushed.push(JSON.stringify(data)); } };
  globals[names.saveUrl] = SITE;
  const applied: string[] = [];
  globals[names.saveApply] = (text: string) => { applied.push(text); for (const pair of text.split(';')) { const at = pair.indexOf('='); if (at > 0) data[pair.slice(0, at)] = pair.slice(at + 1); } };
  globals[names.saveText] = (withDevice: boolean) => Object.entries(data).filter(([name]) => withDevice || !name.startsWith('first_')).map(([name, value]) => `${name}=${String(value)};`).join('');
  globals.loaderInfo = { parameters: { l: login, p: 'the-password' } };
  const gameUploadsSeen: unknown[] = [];
  const uploadCalls: number[] = [];
  globals[names.saveUpload] = () => { uploadCalls.push(1); if (!skipsUpload) gameUploadsSeen.push({ at: Date.now(), login, source: 'game', uid: ID, firstLogin: login, hasProof: true }); };
  globals[names.net][names.connUser] = { login: lobby };
  const asked: Asked[] = [];
  const backups: Record<string, unknown>[] = [];
  globals.fetch = async (url: string, init?: { body?: string }) => {
    if (String(url).endsWith('/netsaves')) return { ok: true, json: async () => ({ loads: [{ at: Date.now() - 60000, login, source: 'game', uid: ID, firstLogin: login, hasProof: true }], uploads: [...gameUploadsSeen] }) };
    if (String(url).includes('/netsavebackups')) {
      if (init && (init as { method?: string }).method === 'POST') {
        const backup = JSON.parse(init.body ?? '{}') as Record<string, unknown>;
        const id = `2026-01-0${backups.length + 1}T00-00-00-000Z_${String(backup.kind)}`;
        backups.unshift({ ...backup, id, at: Date.now() });
        return { ok: true, json: async () => ({ id }) };
      }
      const id = new URL(String(url), 'https://x').searchParams.get('id');
      if (id) return { ok: true, json: async () => backups.find((backup) => backup.id === id) };
      return { ok: true, json: async () => backups.map((backup) => ({ ...backup, values: backup.data ? Object.keys(backup.data).length : 0 })) };
    }
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
  return { game, data, flushed, asked, lines, uploadCalls, backups, applied };
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
  assert.deepEqual(asked.map((entry) => entry.action), ['load', 'save'], 'the network save is backed up, then the upload');
  assert.match(asked[1]?.text ?? '', /first_uid=abc12\.def34\.ghi56\.jkl78;/);
  assert.equal(uploadCalls.length, 0, 'not the game\'s upload');
});

test('an upload keeps a backup of the network save first', async () => {
  const { lines, backups } = await saveGame();
  await lines('netsave upload --direct --yes');
  assert.equal(backups.length, 1);
  assert.deepEqual({ kind: backups[0]?.kind, login: backups[0]?.login, reason: backups[0]?.reason }, { kind: 'online', login: 'player-one', reason: 'before an upload' });
  assert.match(String(backups[0]?.text), /only_online=1;/);
});

test('netsave restore writes the network save over the local one with the game\'s loader, after a local backup and a device id warning', async () => {
  const { lines, applied, backups, data } = await saveGame({ online: 'volume=0.5;first_uid=other.id.from.there;only_online=1;' });
  const told = (await lines('netsave restore')).join('\n');
  assert.match(told, /would write player-one's network save \(3 values, 3 different from now\) over the local save/);
  assert.match(told, /The device id would change from abc12\.def34\.ghi56\.jkl78 to other\.id\.from\.there/);
  assert.equal(applied.length, 0);
  const done = (await lines('netsave restore --yes')).join('\n');
  assert.equal(applied.length, 1);
  assert.equal(backups[0]?.kind, 'local');
  assert.equal((backups[0]?.data as Record<string, unknown>).first_uid, 'abc12.def34.ghi56.jkl78', 'the local save from before');
  assert.match(done, /Restored 3 values from player-one's network save/);
  assert.equal(data.only_online, '1');
});

test('netsave backups lists them, and restore --backup writes one back and uploads it', async () => {
  const { lines, backups, asked, data, flushed } = await saveGame();
  await lines('netsave upload --direct --yes');
  data.volume = 9;
  const listed = (await lines('netsave backups')).join('\n');
  assert.match(listed, /Backups \(1\), newest first:[\s\S]*#1 .* online {2}player-one {2}before an upload/);
  const told = (await lines('netsave restore --backup 1')).join('\n');
  assert.match(told, /would write backup #1 \(online save of player-one, before an upload/);
  asked.length = 0;
  await lines('netsave restore --backup 1 --yes');
  assert.equal(data.volume, '0.5', 'the backup is back in the local save');
  assert.equal(asked[0]?.action, 'save', 'and uploaded, so the next start keeps it');
  assert.equal(backups[0]?.kind, 'local', 'the save from before was backed up first');
  assert.match((await lines('netsave restore --backup 7')).join('\n'), /No backup #7/);
  assert.match(errorsOf((await saveGame()).game.run('netsave restore --backup x'))[0] ?? '', /usage: netsave restore/);
  assert.ok(flushed.length >= 0);
});

test('netsave fields lists the save field by field, typed, the proof hidden, and a filter narrows it', async () => {
  const { lines, data } = await saveGame();
  data.cmpg_nick = 'Player';
  const rows = (await lines('netsave fields')).join('\n');
  assert.match(rows, /Save fields: 5/);
  assert.match(rows, /cmpg_nick +"Player"/);
  assert.match(rows, /volume +1/);
  assert.match(rows, /first_login_proof +‹hidden›/);
  assert.doesNotMatch(rows, /secret-proof/);
  assert.match((await lines('netsave fields vol')).join('\n'), /Save fields matching "vol": 1 of 5/);
});

test('netsave set types the value as the game\'s loader does, backs up once, flushes, and get and del work', async () => {
  const { lines, data, flushed, backups, game } = await saveGame();
  const first = (await lines('netsave set volume 0.25')).join('\n');
  assert.match(first, /Backed up the local save first/);
  assert.match(first, /volume = 0\.25 {2}\(was 1\)/);
  assert.equal(data.volume, 0.25);
  assert.equal(flushed.length, 1);
  await lines('netsave set altcur false');
  await lines('netsave set cmpg_nick some player');
  assert.equal(data.altcur, false);
  assert.equal(data.cmpg_nick, 'some player');
  assert.equal(backups.length, 1, 'one backup per session');
  assert.deepEqual(await lines('netsave get cmpg_nick'), ['> netsave get cmpg_nick', 'cmpg_nick = "some player"']);
  assert.match((await lines('netsave del cmpg_nick')).join('\n'), /Removed cmpg_nick \(was "some player"\)/);
  assert.equal('cmpg_nick' in data, false);
  assert.match((await lines('netsave set skin_allowed_2 1')).join('\n'), /stays in this install's save only/);
  assert.match(errorsOf(game.run('netsave set volume NaN'))[0] ?? '', /cannot be stored/);
  assert.match(errorsOf(game.run('netsave get nothing_here'))[0] ?? '', /no field "nothing_here"/);
});
