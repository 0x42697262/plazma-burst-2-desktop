import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { contentTypeOf, escapeHtml, lobbyHostOf, readJoinForm, safeRelativePath } from './web.ts';

test('web client: the join form needs a nickname; the password may be empty', () => {
  assert.deepEqual(readJoinForm('nickname=+Pal+&password=').form, { nickname: 'Pal', password: '' });
  assert.deepEqual(readJoinForm('nickname=Boss&password=a%20secret').form, { nickname: 'Boss', password: 'a secret' });
  assert.match(readJoinForm('nickname=&password=x').problem ?? '', /nickname/);
  assert.match(readJoinForm(`nickname=${'x'.repeat(21)}`).problem ?? '', /too long/);
});

test('web client: game file paths stay inside the game folder', () => {
  assert.equal(safeRelativePath('scripts/libs/flash.js'), path.join('scripts', 'libs', 'flash.js'));
  assert.equal(safeRelativePath('/scripts//x%20y.js'), path.join('scripts', 'x y.js'));
  assert.equal(safeRelativePath('../data/credentials.json'), null);
  assert.equal(safeRelativePath('scripts/%2e%2e/%2e%2e/x'), null);
  assert.equal(safeRelativePath('.git/config'), null);
  assert.equal(safeRelativePath('%E0%A4%A'), null, 'not a path');
});

test('web client: content types, escaping, and the address the game connects back to', () => {
  assert.match(contentTypeOf('scripts/flash.js'), /javascript/);
  assert.equal(contentTypeOf('x.unknown'), 'application/octet-stream');
  assert.equal(escapeHtml('<b>"Pal\'s" & co</b>'), '&lt;b&gt;&quot;Pal&#39;s&quot; &amp; co&lt;/b&gt;');
  assert.equal(lobbyHostOf('https://pb2.example.test', 'ignored:1'), 'pb2.example.test');
  assert.equal(lobbyHostOf('https://pb2.example.test:8443', undefined), 'pb2.example.test:8443');
  assert.equal(lobbyHostOf('', '127.0.0.1:2053'), '127.0.0.1:2053', 'no public_url: the address the browser used');
});
