// desktop/login.js against a fake of Electron's cookie store: "npm test".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { loadCredentials, applyLogin } = createRequire(import.meta.url)('../desktop/login.js');
const HOST = 'www.plazmaburst2.com';

// Electron's session.cookies, as far as login.js uses it.
function cookieStore(initial) {
  let jar = initial.map((c) => ({ path: '/', secure: true, ...c }));
  const bare = (d) => d.replace(/^\./, '');
  return {
    jar: () => jar,
    flushed: 0,
    async get({ domain }) { return jar.filter((c) => bare(c.domain) === domain || bare(c.domain).endsWith(`.${domain}`)); },
    async remove(url, name) {
      const u = new URL(url);
      jar = jar.filter((c) => !(c.name === name && bare(c.domain) === u.hostname && c.path === u.pathname));
    },
    async set(c) { jar = jar.filter((x) => !(x.name === c.name && x.domain === c.domain)).concat([{ ...c }]); },
    async flushStore() { this.flushed++; },
  };
}

const saved = () => cookieStore([
  { domain: '.plazmaburst2.com', name: 'login', value: 'old_account' },
  { domain: '.plazmaburst2.com', name: 'password', value: 'old_secret' },
  { domain: '.plazmaburst2.com', name: 'pb2uid', value: '111' },
  { domain: 'www.plazmaburst2.com', name: 'session', value: 'x', path: '/pb2/' },
  { domain: '.example.com', name: 'other', value: 'kept' },
]);

test('without credentials, the saved login is cleared and nothing is set', async () => {
  const cookies = saved();
  const r = await applyLogin(cookies, {}, HOST);
  assert.deepEqual(r.set, []);
  assert.deepEqual(r.removed.sort(), ['login', 'password', 'pb2uid', 'session']);
  assert.deepEqual(cookies.jar().map((c) => c.name), ['other'], 'another site\'s cookie stays');
  assert.equal(cookies.flushed, 1, 'written to disk now');
});

test('with credentials, only that account\'s cookies exist', async () => {
  const cookies = saved();
  await applyLogin(cookies, { login: 'new_account', password: 'new_secret' }, HOST);
  const site = cookies.jar().filter((c) => c.domain.endsWith('plazmaburst2.com'));
  assert.deepEqual(site.map((c) => [c.name, c.value]).sort(), [['login', 'new_account'], ['password', 'new_secret']]);
  assert.ok(!site.some((c) => c.name === 'pb2uid'), 'no stale pb2uid from the old account');
  assert.ok(site.every((c) => c.secure && c.domain === '.plazmaburst2.com'));
});

test('credentials: env vars win over the file, and unset ones are left out', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-login-'));
  const file = path.join(dir, 'credentials.json');
  assert.deepEqual(loadCredentials(file, {}), {}, 'no file, no env: nothing');
  fs.writeFileSync(file, JSON.stringify({ login: 'file_login', password: 'file_pw', pb2uid: '' }));
  assert.deepEqual(loadCredentials(file, {}), { login: 'file_login', password: 'file_pw' });
  assert.deepEqual(loadCredentials(file, { login: 'env_login', pb2uid: 42 }), { login: 'env_login', password: 'file_pw', pb2uid: '42' });
  fs.writeFileSync(file, '{ not json');
  assert.deepEqual(loadCredentials(file, {}), {}, 'a broken file counts as none');
  fs.rmSync(dir, { recursive: true });
});
