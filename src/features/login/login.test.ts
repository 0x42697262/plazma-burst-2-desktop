import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLogin, type Cookie, type CookieStore } from './adapters/cookies.ts';
import { readCredentialsFile } from './adapters/credentials-file.ts';
import { mergeCredentials } from './domain/credentials.ts';
import { createLogin } from './wrapper.ts';
import type { Logger } from '#kernel/log/logger.ts';

const HOST = 'www.plazmaburst2.com';

type StoredCookie = Cookie & { value: string; domain: string; path: string };
type FakeStore = CookieStore & { jar(): StoredCookie[]; flushed: number };

function cookieStore(initial: readonly (Omit<StoredCookie, 'path'> & { path?: string })[]): FakeStore {
  let jar: StoredCookie[] = initial.map((cookie) => ({ path: '/', secure: true, ...cookie }));
  const bare = (domain: string): string => domain.replace(/^\./, '');
  const store: FakeStore = {
    jar: () => jar,
    flushed: 0,
    async get({ domain }) { return jar.filter((cookie) => bare(cookie.domain) === domain || bare(cookie.domain).endsWith(`.${domain}`)); },
    async remove(url, name) {
      const parsed = new URL(url);
      jar = jar.filter((cookie) => !(cookie.name === name && bare(cookie.domain) === parsed.hostname && cookie.path === parsed.pathname));
    },
    async set(cookie) { jar = jar.filter((stored) => !(stored.name === cookie.name && stored.domain === cookie.domain)).concat([{ ...cookie }]); },
    async flushStore() { store.flushed++; },
  };
  return store;
}

const saved = (): FakeStore => cookieStore([
  { domain: '.plazmaburst2.com', name: 'login', value: 'old_account' },
  { domain: '.plazmaburst2.com', name: 'password', value: 'old_secret' },
  { domain: '.plazmaburst2.com', name: 'pb2uid', value: '111' },
  { domain: 'www.plazmaburst2.com', name: 'session', value: 'x', path: '/pb2/' },
  { domain: '.example.com', name: 'other', value: 'kept' },
]);

const quietLog = (lines: string[]): Logger => ({ info: (line: string) => { lines.push(line); }, error: (line: string) => { lines.push(line); } }) as unknown as Logger;

test('without credentials, the saved login is cleared and nothing is set', async () => {
  const cookies = saved();
  const result = await applyLogin(cookies, {}, HOST);
  assert.deepEqual(result.set, []);
  assert.deepEqual(result.removed.sort(), ['login', 'password', 'pb2uid', 'session']);
  assert.deepEqual(cookies.jar().map((cookie) => cookie.name), ['other'], 'another site\'s cookie stays');
  assert.equal(cookies.flushed, 1, 'written to disk now');
});

test('with credentials, only that account\'s cookies exist', async () => {
  const cookies = saved();
  await applyLogin(cookies, { login: 'new_account', password: 'new_secret' }, HOST);
  const site = cookies.jar().filter((cookie) => cookie.domain.endsWith('plazmaburst2.com'));
  assert.deepEqual(site.map((cookie) => [cookie.name, cookie.value]).sort(), [['login', 'new_account'], ['password', 'new_secret']]);
  assert.ok(!site.some((cookie) => cookie.name === 'pb2uid'), 'no stale pb2uid from the old account');
  assert.ok(site.every((cookie) => cookie.secure && cookie.domain === '.plazmaburst2.com'));
});

test('credentials: the environment wins over the file, and unset ones are left out', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-login-'));
  const file = path.join(folder, 'credentials.json');
  const load = (fromEnvironment: Record<string, unknown>) => mergeCredentials(readCredentialsFile(file, () => {}), fromEnvironment);
  try {
    assert.deepEqual(load({}), {}, 'no file, no environment: nothing');
    fs.writeFileSync(file, '\uFEFF' + JSON.stringify({ login: 'file_login', password: 'file_pw', pb2uid: '' }));
    assert.deepEqual(load({}), { login: 'file_login', password: 'file_pw' });
    assert.deepEqual(load({ login: 'env_login', pb2uid: 42 }), { login: 'env_login', password: 'file_pw', pb2uid: '42' });
    fs.writeFileSync(file, '{ not json');
    const reported: string[] = [];
    assert.deepEqual(readCredentialsFile(file, (message) => { reported.push(message); }), {}, 'a broken file counts as none');
    assert.equal(reported.length, 1);
  } finally {
    fs.rmSync(folder, { recursive: true });
  }
});

test('with the login flag off, the saved credentials are not used and the game starts logged out', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-login-'));
  fs.writeFileSync(path.join(folder, 'credentials.json'), JSON.stringify({ login: 'file_login', password: 'file_pw' }));
  try {
    const lines: string[] = [];
    const cookies = saved();
    await createLogin({ log: quietLog(lines), dataDir: folder, host: HOST, fromEnvironment: { login: 'env_login' }, isOn: false }).applyCredentials(cookies);
    assert.deepEqual(cookies.jar().map((cookie) => cookie.name), ['other']);
    assert.match(lines.at(-1) ?? '', /Login is off/);
    const onCookies = saved();
    await createLogin({ log: quietLog([]), dataDir: folder, host: HOST, fromEnvironment: {}, isOn: true }).applyCredentials(onCookies);
    assert.deepEqual(onCookies.jar().filter((cookie) => cookie.domain === '.plazmaburst2.com').map((cookie) => cookie.name).sort(), ['login', 'password']);
  } finally {
    fs.rmSync(folder, { recursive: true });
  }
});
