// Remote play testers: who may connect, by secret token. Stored in
// desktop/remote-testers.json (not in git):
//   { "testers": { "alice": { "token": "...", "added": "2025-10-30T12:00:00.000Z" } } }
// A tester's link carries the token after "#", so it is never sent in a URL to the
// server (or logged by a tunnel); the page sends it over the WebSocket instead.
// Manage with: npm run testers -- add <name> | remove <name> | list
'use strict';

const fs = require('fs');
const crypto = require('crypto');

const TOKEN_BYTES = 24;
const NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;

function read(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data && typeof data.testers === 'object' && data.testers ? data : { testers: {} };
  } catch {
    return { testers: {} };
  }
}

function write(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
}

function checkName(name) {
  const n = String(name || '').toLowerCase();
  if (!NAME.test(n)) throw new Error('a tester name is 1-32 letters, digits, "-" or "_", starting with a letter or digit');
  return n;
}

// Returns the new token. Adding an existing name gives it a new token (the old link stops working).
function addTester(file, name) {
  const n = checkName(name);
  const data = read(file);
  const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');
  data.testers[n] = { token, added: new Date().toISOString() };
  write(file, data);
  return { name: n, token };
}

function removeTester(file, name) {
  const n = checkName(name);
  const data = read(file);
  if (!data.testers[n]) return false;
  delete data.testers[n];
  write(file, data);
  return true;
}

const listTesters = (file) => Object.entries(read(file).testers).map(([name, t]) => ({ name, added: t.added || '' }));

// The tester a token belongs to, or null. Read from disk each time, so adding or
// removing a tester needs no restart. Every token is compared in constant time.
function findTester(file, token) {
  if (typeof token !== 'string' || !token) return null;
  const want = crypto.createHash('sha256').update(token).digest();
  let found = null;
  for (const [name, t] of Object.entries(read(file).testers)) {
    if (typeof t.token !== 'string') continue;
    const have = crypto.createHash('sha256').update(t.token).digest();
    if (crypto.timingSafeEqual(want, have) && !found) found = { name };
  }
  return found;
}

module.exports = { addTester, removeTester, listTesters, findTester, checkName };
