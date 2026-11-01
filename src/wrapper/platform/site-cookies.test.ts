import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSiteCookies, type SiteCookie, type SiteCookieStore } from './site-cookies.ts';

function fakeCookies(initial: SiteCookie[]) {
  let jar = [...initial];
  const store: SiteCookieStore = {
    get: async () => jar.map((cookie) => ({ ...cookie })),
    remove: async (_url, name) => { jar = jar.filter((cookie) => cookie.name !== name); },
    set: async (details) => { jar = [...jar.filter((cookie) => cookie.name !== details.name), { ...details, hostOnly: details.domain === undefined }]; },
    flushStore: async () => undefined,
  };
  return { store, names: () => jar.map((cookie) => `${cookie.name}=${cookie.value ?? ''}`).sort() };
}

const officialLogin: SiteCookie[] = [
  { name: 'login', value: 'Pal', domain: '.plazmaburst2.com', path: '/', secure: true, httpOnly: false, hostOnly: false, expirationDate: 2000000000 },
  { name: 'password', value: 'secret', domain: '.plazmaburst2.com', path: '/', secure: true, httpOnly: true, hostOnly: false },
];

test('a private server never sees the official login, and the official server gets it back afterwards', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-cookies-'));
  const stashFile = path.join(folder, 'official-login.json');
  try {
    const cookies = fakeCookies(officialLogin);
    const site = createSiteCookies(cookies.store, stashFile);

    assert.deepEqual(await site.hideForPrivateServer(), ['login', 'password']);
    assert.deepEqual(cookies.names(), [], 'nothing of the official login is left for the private server');
    assert.equal(fs.statSync(stashFile).mode & 0o777, 0o600, 'only you can read the kept login');

    await cookies.store.set({ url: 'https://plazmaburst2.com/', name: 'login', value: 'Guest', path: '/', secure: true, httpOnly: false });
    await site.hideForPrivateServer();
    assert.deepEqual(await site.restoreOfficial(), ['login', 'password'], 'a second private visit keeps the official login, not its own');
    assert.deepEqual(cookies.names(), ['login=Pal', 'password=secret']);
    assert.equal(fs.existsSync(stashFile), false, 'restored once, then forgotten');

    assert.deepEqual(await site.restoreOfficial(), [], 'nothing kept: the cookies here stay as they are');
    assert.deepEqual(cookies.names(), ['login=Pal', 'password=secret']);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
