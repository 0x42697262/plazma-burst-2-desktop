// The game's login, as cookies. The game logs in with the "login" and "password"
// cookies (scripts/flash.js reads them into loaderInfo.parameters), and "pb2uid" goes
// with them. The page never writes them: the site's own login does, or applyLogin below.
// They live in Electron's persistent session, so every start clears the site's cookies
// first: without credentials the game starts logged out instead of reusing whatever
// account logged in last time, and with credentials only that account's cookies exist.
// Saved games and settings are in localStorage and are not touched.
const fsSync = require('fs');
const path = require('path');

const SITE = 'plazmaburst2.com';
const CREDENTIAL_KEYS = Object.freeze(['login', 'password', 'pb2uid']);
const COOKIE_LIFETIME_S = 365 * 24 * 3600;

// The environment's (PB2_LOGIN, PB2_PASSWORD, PB2_UID, read by src/kernel/config/) win over
// credentials.json: { "login": "...", "password": "...", "pb2uid": "..." }.
// Returns only the ones that are set.
function loadCredentials(file, fromEnvironment = {}) {
  let saved = {};
  if (fsSync.existsSync(file)) {
    try {
      saved = JSON.parse(fsSync.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error(`Could not parse ${file}: ${e.message}`);
    }
  }
  const out = {};
  for (const name of CREDENTIAL_KEYS) {
    const value = fromEnvironment[name] ?? saved[name];
    if (value !== undefined && value !== null && value !== '') out[name] = String(value);
  }
  return out;
}

const cookieUrl = (c) => `http${c.secure ? 's' : ''}://${c.domain.replace(/^\./, '')}${c.path}`;

// Removes every cookie of the game's site (subdomains too). Returns their names.
async function clearSiteCookies(cookies) {
  const site = await cookies.get({ domain: SITE });
  for (const c of site) await cookies.remove(cookieUrl(c), c.name);
  return site.map((c) => c.name);
}

// Clears the site's cookies, then sets the credentials as login cookies. Returns what it
// did, for the log: { removed: [names], set: [names] }.
async function applyLogin(cookies, credentials, host) {
  const removed = await clearSiteCookies(cookies);
  const expirationDate = Math.floor(Date.now() / 1000) + COOKIE_LIFETIME_S;
  for (const [name, value] of Object.entries(credentials)) {
    await cookies.set({ url: `https://${host}/`, domain: `.${SITE}`, path: '/', name, value, secure: true, expirationDate });
  }
  await cookies.flushStore(); // write the change to disk now, not when the session closes
  return { removed, set: Object.keys(credentials) };
}

module.exports = { loadCredentials, applyLogin, CREDENTIAL_KEYS };
