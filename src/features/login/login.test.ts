import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLogin, type Cookie, type CookieStore } from './adapters/cookies.ts';
import { createAccountBook } from './services/account-book.ts';
import { PLAIN_KEYCHAIN, type Keychain } from './adapters/keychain.ts';
import { mergeCredentials, passwordCookie } from './domain/credentials.ts';
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
  const bookOf = (reportUnreadable: (message: string) => void = () => {}) => createAccountBook({ file, keychain: PLAIN_KEYCHAIN, now: () => 'now', reportUnreadable, warn: () => {} });
  const load = (fromEnvironment: Record<string, unknown>) => mergeCredentials(bookOf().activeSecrets(), fromEnvironment);
  try {
    assert.deepEqual(load({}), {}, 'no file, no environment: nothing');
    fs.writeFileSync(file, '\uFEFF' + JSON.stringify({ login: 'file_login', password: 'file_pw', pb2uid: '' }));
    assert.deepEqual(load({}), { login: 'file_login', password: 'file_pw' });
    assert.deepEqual(load({ login: 'env_login', pb2uid: 42 }), { login: 'env_login', password: 'file_pw', pb2uid: '42' });
    fs.writeFileSync(file, '{ not json');
    const reported: string[] = [];
    assert.deepEqual(bookOf((message) => { reported.push(message); }).activeSecrets(), {}, 'a broken file counts as none');
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

const REVERSING_KEYCHAIN: Keychain = {
  canEncrypt: () => true,
  seal: (text) => [...text].reverse().join(''),
  open: (secret) => [...secret].reverse().join(''),
};

function accountsFolder() {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-accounts-'));
  const file = path.join(folder, 'credentials.json');
  const warnings: string[] = [];
  const bookWith = (keychain: Keychain) => createAccountBook({ file, keychain, now: () => '2026-11-05', reportUnreadable: (message) => { warnings.push(message); }, warn: (message) => { warnings.push(message); } });
  return { file, warnings, bookWith, cleanup: () => fs.rmSync(folder, { recursive: true }) };
}

test('the password cookie is the password\'s md5; a value already like one is kept', () => {
  assert.equal(passwordCookie('password'), '5f4dcc3b5aa765d61d8327deb882cf99');
  assert.equal(passwordCookie('5f4dcc3b5aa765d61d8327deb882cf99'), '5f4dcc3b5aa765d61d8327deb882cf99');
});

test('a plain password in the old file or the environment reaches the game as its md5', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-login-'));
  try {
    const cookies = saved();
    await createLogin({ log: quietLog([]), dataDir: folder, host: HOST, fromEnvironment: { login: 'env', password: 'password' }, isOn: true }).applyCredentials(cookies);
    assert.equal(cookies.jar().find((cookie) => cookie.name === 'password')?.value, '5f4dcc3b5aa765d61d8327deb882cf99');
  } finally { fs.rmSync(folder, { recursive: true }); }
});

test('accounts: several saved, one active, secrets encrypted on disk, the file readable only by you', () => {
  const context = accountsFolder();
  try {
    const book = context.bookWith(REVERSING_KEYCHAIN);
    book.add('one', { password: 'abc1', pb2uid: '11' });
    book.add('two', { password: 'xyz2' });
    assert.deepEqual(book.activeSecrets(), { login: 'two', password: 'xyz2' });
    assert.deepEqual(book.list(), [{ login: 'one', active: false, updatedAt: '2026-11-05' }, { login: 'two', active: true, updatedAt: '2026-11-05' }]);
    book.use('one');
    assert.deepEqual(book.activeSecrets(), { login: 'one', password: 'abc1', pb2uid: '11' });
    const onDisk = fs.readFileSync(context.file, 'utf8');
    assert.ok(!onDisk.includes('abc1') && !onDisk.includes('xyz2'), 'no secret in the clear');
    assert.equal(JSON.parse(onDisk).schemaVersion, 1);
    assert.equal(fs.statSync(context.file).mode & 0o777, 0o600);
    assert.throws(() => book.use('three'), /No saved account/);
  } finally { context.cleanup(); }
});

test('accounts: the old plain file is one active account, and is encrypted the first time it is read', () => {
  const context = accountsFolder();
  const oldPassword = '0123456789abcdef0123456789abcdef';
  const oldFile = JSON.stringify({ login: 'old', password: oldPassword, pb2uid: '77' });
  try {
    fs.writeFileSync(context.file, oldFile);
    const book = context.bookWith(REVERSING_KEYCHAIN);
    assert.deepEqual(book.activeSecrets(), { login: 'old', password: oldPassword, pb2uid: '77' });
    assert.ok(!fs.readFileSync(context.file, 'utf8').includes(oldPassword), 'encrypted on disk from now on');
    assert.equal(fs.statSync(context.file).mode & 0o777, 0o600);
    book.add('new', { password: 'ddd' });
    book.use('old');
    assert.deepEqual(book.activeSecrets(), { login: 'old', password: oldPassword, pb2uid: '77' });
  } finally { context.cleanup(); }
});

test('accounts: without a keychain they stay plain and it says so; one that cannot be opened is reported, not used', () => {
  const context = accountsFolder();
  try {
    context.bookWith(PLAIN_KEYCHAIN).add('me', { password: 'eee' });
    assert.match(context.warnings[0] ?? '', /no keychain/);
    assert.equal(context.bookWith(PLAIN_KEYCHAIN).activeSecrets().password, 'eee');
    const sealed = context.bookWith(REVERSING_KEYCHAIN);
    sealed.add('me', { password: 'fff' });
    const broken: Keychain = { ...REVERSING_KEYCHAIN, open: () => { throw new Error('locked'); } };
    assert.deepEqual(context.bookWith(broken).activeSecrets(), {});
    assert.match(context.warnings.at(-1) ?? '', /log in to it again/);
  } finally { context.cleanup(); }
});

test('accounts: removing the active one leaves none active and asks for a sign-out once', () => {
  const context = accountsFolder();
  try {
    const book = context.bookWith(REVERSING_KEYCHAIN);
    book.add('one', { token: 't1' });
    book.add('two', { token: 't2' });
    book.remove('one');
    assert.equal(book.takeSignOut(), false, 'it was not the active one');
    book.remove('two');
    assert.deepEqual(book.activeSecrets(), {});
    assert.equal(book.takeSignOut(), true);
    assert.equal(book.takeSignOut(), false, 'only once');
    book.add('three', { token: 't3' });
    book.remove('three');
    book.add('four', { token: 't4' });
    assert.equal(book.takeSignOut(), false, 'a new active account replaces the sign-out');
  } finally { context.cleanup(); }
});
