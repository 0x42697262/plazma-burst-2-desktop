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
  `src/kernel/config/`), which win over `data/credentials.json`
  (`{ "login": "...", "password": "...", "pb2uid": "..." }`). Empty values count as unset.
  A file that is not JSON is reported and counts as none. The app never writes that file.
- A private server always starts logged out, so the page never has your PB2 account:
  the site's cookies are put aside in `data/official-login.json` (readable only by you)
  and removed (`src/wrapper/platform/site-cookies.ts`). The next time the official
  server is chosen without credentials, they come back and the file is deleted; with
  credentials, the file is deleted and the credentials are used. A second private visit
  keeps the first one's official login, not its own cookies.
- Remote play's tester sessions get the same credentials, without the log lines.
- With the flag off, no credentials are used; the game's own login is kept as above.
