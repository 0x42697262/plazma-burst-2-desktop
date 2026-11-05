# login

Feature flag `login` (on by default; all modes). Code: `src/features/login/`.

- The game logs in with the `login` and `password` cookies (the game's `scripts/flash.js`
  reads them into `loaderInfo.parameters`); `pb2uid` goes with them. The page never
  writes them: the site's own login does, or this feature.
- The cookies live in Electron's persistent session. When the official server is chosen
  with credentials, every cookie of `plazmaburst2.com` (subdomains too) is cleared first,
  so only that account's cookies exist. Without credentials the cookies are left as they
  are: a player who logged in through the game's own login stays logged in. Saved games
  and settings are in localStorage and are not touched. The store is flushed at once,
  not when the session closes.
- Credentials come from `PB2_LOGIN`, `PB2_PASSWORD` and `PB2_UID` (read by
  `src/kernel/config/`), which win over the active account in `data/credentials.json`.
  Empty values count as unset. A file that is not JSON is reported and counts as none.
- The `password` cookie is the md5 of the account's password, so it works as the password.
  A value that is not 32 hex digits, from the environment or an old file, is treated as the
  plain password and hashed before it is used (`passwordCookie`).

## Saved accounts
Capability `login.accounts`. `data/credentials.json` (official) and
`data/credentials.sadburst.json` (Sad Burst 2) hold
`{ "schemaVersion": 1, "active": "<login>", "accounts": { "<login>": { "login", "secret", "encrypted", "updatedAt" } }, "signOut": false }`,
readable only by you.
- `secret` is the account's JSON (`password` and `pb2uid`, or `token`), encrypted with the
  system keychain through Electron's `safeStorage`. Where there is no real keychain (Linux
  without a secret service falls back to a fixed key), it stays plain and the log says so.
- There is no plain copy of the active account at the top level: it would undo the
  encryption. Nothing but `src/features/login/` reads these files.
- An old `{ "login", "password", "pb2uid" }` file counts as one active account, and it is
  rewritten encrypted the first time it is read. Keep a backup if you still swap those files
  by hand; a swapped-in old file is picked up the same way.
- If the keychain changes and a secret cannot be opened, the log says to log in again, and
  that account is treated as not logged in.
- A private server always starts logged out, so the page never has your PB2 account:
  the site's cookies are put aside in `data/official-login.json` (readable only by you)
  and removed (`src/wrapper/platform/site-cookies.ts`). The next time the official
  server is chosen without credentials, they come back and the file is deleted; with
  credentials, the file is deleted and the credentials are used. A second private visit
  keeps the first one's official login, not its own cookies.
- Remote play's tester sessions get the same credentials, without the log lines.
- With the flag off, no credentials are used; the game's own login is kept as above.
