# login

Feature flag `login` (on by default; all modes). Code: `src/features/login/`.

- The game logs in with the `login` and `password` cookies (the game's `scripts/flash.js`
  reads them into `loaderInfo.parameters`); `pb2uid` goes with them. The page never
  writes them: the site's own login does, or this feature.
- The cookies live in Electron's persistent session, so each time the official server is
  chosen every cookie of `plazmaburst2.com` (subdomains too) is cleared first. Without
  credentials the game starts logged out instead of reusing whichever account logged in
  last; with credentials only that account's cookies exist. Saved games and settings are
  in localStorage and are not touched. The store is flushed at once, not when the session
  closes.
- Credentials come from `PB2_LOGIN`, `PB2_PASSWORD` and `PB2_UID` (read by
  `src/kernel/config/`), which win over `desktop/credentials.json`
  (`{ "login": "...", "password": "...", "pb2uid": "..." }`). Empty values count as unset.
  A file that is not JSON is reported and counts as none. The app never writes that file.
- A private server always starts logged out: the site's cookies are cleared and none are
  set, so the page never has your PB2 account.
- Remote play's tester sessions get the same credentials, without the log lines.
- With the flag off, the cookies are still cleared and none are set: the game always
  starts logged out, and the log says the login is off.
