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
  plain password and hashed before it is used (`passwordCookie`). What other features read
  (`identity`, [diagnostics](diagnostics.md) writes it into a report) is the raw string, as
  it was stored or given: plaintext from the environment or an old file, the site's md5
  otherwise. A report carries that raw string; the app hashes nothing for it.

## Choosing an account
In the server list, selecting the official server or Sad Burst 2 shows the account panel:
pick a saved account, forget one, or "Log in to a new account" (capability `login.site`).
A private server shows no panel: there you have a nickname and that server's own password.
Logging in appears nowhere else, not in the app menu and not in the console. The choice is
used the next time that game starts.
- **Official**: a window opens the site's own login page (`?a=&s=8`, the one the game opens)
  in a separate session kept only in memory, so it starts logged out and leaves nothing
  behind. The site sits behind a Cloudflare challenge and a script check, which is why it
  is a real window. The site sets `login`, `password` and `pb2uid` on `www.plazmaburst2.com`
  only, and Electron's `cookies.get({ domain })` leaves such host-only cookies out, so every
  lookup of the site's cookies reads them all and keeps those of `plazmaburst2.com` and its
  subdomains (`siteCookiesIn`). When the `login` cookie and a `password` cookie shaped like an md5
  appear, the app asks the site once more and checks that it kept them, then saves
  `login`, `password` and `pb2uid`. If the site cannot be reached or drops them, nothing is saved.
- **Sad Burst 2**: a small form posts to `/api/game/client-login`, then confirms the token with
  `/api/game/client-session`, as the game's own start screen does. The password is not saved,
  only the token. A refused or unconfirmed login saves nothing.
- Sad Burst's game reads `auth_token` from localStorage, so the app puts the active account's
  token there when the game page first loads (a script before the game's own, in
  `prepareIndex`). With no active account it leaves the storage alone, so the game's own login
  keeps working. Forgetting the active account removes the token at the next start.
- Forgetting the active official account clears the site's cookies at once.

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
