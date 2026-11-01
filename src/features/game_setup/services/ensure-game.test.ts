import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ensureGame, type GameSetupDeps } from './ensure-game.ts';

function fakeGame(options: { local: string | null; latest?: string | Error | null; checksForUpdates?: boolean; namesMatch?: boolean; missingNames?: string[] }) {
  let local = options.local;
  const said: string[] = [];
  const downloads: (string | null)[] = [];
  let namesRuns = 0;
  const deps: GameSetupDeps = {
    localVersion: () => local,
    latestVersion: options.latest === null ? null : async () => {
      if (options.latest instanceof Error) throw options.latest;
      return options.latest ?? 'v2';
    },
    checksForUpdates: options.checksForUpdates ?? false,
    download: async (version) => { downloads.push(version); local = version ?? 'build'; return []; },
    namesMatchGame: () => options.namesMatch ?? true,
    findNames: () => { namesRuns += 1; return { missing: options.missingNames ?? [] }; },
    say: (line) => { said.push(line); },
    note: (line) => { said.push(line); },
  };
  return { deps, said, downloads, namesRuns: () => namesRuns };
}

test('no game yet: the latest version is downloaded and its names are found', async () => {
  const game = fakeGame({ local: null, latest: 'v2' });
  assert.deepEqual(await ensureGame(game.deps), { ready: true, downloaded: true, problems: [] });
  assert.deepEqual(game.downloads, ['v2']);
  assert.equal(game.namesRuns(), 1);
});

test('a game here and no update checks (running from the repository): nothing is downloaded', async () => {
  const game = fakeGame({ local: 'v1', latest: 'v2', checksForUpdates: false });
  assert.deepEqual(await ensureGame(game.deps), { ready: true, downloaded: false, problems: [] });
  assert.deepEqual(game.downloads, []);
  assert.equal(game.namesRuns(), 0, 'the names already match');
});

test('an installed app updates to a new version, and finds the names again', async () => {
  const game = fakeGame({ local: 'v1', latest: 'v2', checksForUpdates: true });
  assert.deepEqual(await ensureGame(game.deps), { ready: true, downloaded: true, problems: [] });
  assert.ok(game.said.includes('A new game version is out (v2; here: v1).'), game.said.join('\n'));
  assert.equal(game.namesRuns(), 1);
});

test('offline with a game here: play that copy; offline without one: not ready, and why', async () => {
  const offline = fakeGame({ local: 'v1', latest: new Error('no network'), checksForUpdates: true });
  assert.deepEqual(await ensureGame(offline.deps), { ready: true, downloaded: false, problems: [] });
  assert.match(offline.said.join('\n'), /Could not check for a new game version \(no network\); playing the copy here \(v1\)/);
  const nothing = fakeGame({ local: null, latest: new Error('no network') });
  assert.deepEqual(await ensureGame(nothing.deps), { ready: false, downloaded: false, problems: ['The game is not here yet, and it could not be downloaded: no network'] });
});

test('names that do not match the game are found again; missing ones are a problem', async () => {
  const game = fakeGame({ local: 'v1', namesMatch: false, missingNames: ['connRecv'] });
  const result = await ensureGame(game.deps);
  assert.equal(result.ready, true);
  assert.match(result.problems[0] ?? '', /names were not found: connRecv\. Joining private servers is refused/);
});

test('names that cannot be written are a problem, not a crash: the game is still ready', async () => {
  const game = fakeGame({ local: 'v1', namesMatch: false });
  const failing = { ...game.deps, findNames: () => { throw new Error('ENOENT data/names.js'); } };
  const result = await ensureGame(failing);
  assert.equal(result.ready, true);
  assert.match(result.problems[0] ?? '', /names could not be found \(ENOENT data\/names\.js\)/);
});

test('a client without a version check (Sad Burst 2) downloads only when it is missing', async () => {
  const here = fakeGame({ local: 'build', latest: null, checksForUpdates: true });
  assert.deepEqual((await ensureGame(here.deps)).downloaded, false);
  const missing = fakeGame({ local: null, latest: null });
  assert.deepEqual(await ensureGame(missing.deps), { ready: true, downloaded: true, problems: [] });
  assert.deepEqual(missing.downloads, [null]);
});
