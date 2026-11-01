# server_list: the server list and private servers

Feature flag `server_list` (on by default; local mode, official client only). Code:
`src/features/server_list/`.

## What it does

`npm start` opens the server list before the game. The page is
`src/features/server_list/launcher/`, built to `dist/launcher/`. The list holds:
- the official server;
- private servers (`npm run server`, [private-server](../operations/private-server.md)),
  saved in `data/servers.json`.

The console's `servers` command does everything the page does.

On a private server:
- the game's lobby connection goes to that server instead, and trusts only its pinned
  certificate;
- the game starts logged out (the site's cookies are cleared), so the server gets a
  nickname and its own password, never your PB2 account.

With the flag off (and always for Sad Burst 2, which has its own servers and accounts),
the window goes straight to the game, there is no Servers menu, and the console has no
`servers`.

## The saved file

`data/servers.json`, versioned ([ADR 0004](../adr/0004-versioned-local-files.md)),
written with mode `0600` because it holds passwords:

    { "schemaVersion": 1,
      "servers": [{ "id", "name", "address": "203.0.113.5:2053", "fingerprint": "0B:3A:...",
                    "nickname": "Pal", "password": "..." }],
      "last": "<id>" }

- Version 0 (no `schemaVersion`) is the layout from before. It is migrated on first read.
- A broken entry is left out and reported as a problem; the others still load.
- `data/join.json` (from before the server list) is imported once, when there is no
  `servers.json` yet.

## Certificates

- A private server's `fingerprint` is the SHA-256 of its certificate, as the server's
  terminal prints it.
- The game connects to that address only when the certificate there is exactly this one
  (the session's certificate check, `src/features/cert_pinning/`).
- `/status` (name, description, players, version, whether a password is needed) is read
  only from a server showing the pinned certificate. Another certificate is reported as
  "not the saved one", because someone else may be at that address.
- "Get from server" / `fingerprint=fetch` does only the TLS handshake and sends nothing.
  Compare the result with the fingerprint the host sent you.

## Passwords never move to a new address (security fix 2)

Before 2026-11-02, saving an entry without a `password` kept the saved one, whatever
else changed. Page code that a lobby server pushes (RELIABLE_TASK,
[fingerprinting](../research/fingerprinting.md) §9) could therefore change a saved
server's address and certificate through `__dev/servers`, then `play` it. The game would
send the saved password to an address of the attacker's choice.

Now `passwordForSave` (in `domain/server.ts`) decides:
- a `password` given with the save is always used;
- otherwise the saved password is kept only while the address and the fingerprint both
  stay the same;
- a dropped password is logged, and the list shows "needs a password (Edit)".

## Routes and the page's bridge

- **The list page** (`file://`) talks to the main process through
  `window.pb2servers`. That bridge is the preload's (`launcher/preload.ts`), and the
  main process answers only that page's frame. Passwords never reach the page; it learns
  `hasPassword`.
- **The console** uses `POST __dev/servers { op, arg }`, with op one of `list`, `save`,
  `remove`, `check`, `fingerprint`, `play`, `openList`. It answers 403 for a remote play
  tester or the p2p host, 405 for anything but POST, and 400 for bad JSON or an unknown
  op.
- **`servers add`**: a typed `password=` is masked in the history and the log (`mask`).

## Joining in the page

The wrapper sets `PB2_JOIN` (not enumerable) before any script: `{ address, nickname,
password }`. The page core's join client (`services/join-client.ts`, started by
`page.ts`), every 100 ms:
- **Lobby address**: points every lobby address start at
  `https://<address>/?`. The game builds the lobby address as
  `<start> + "plazmaburst2.com:" + port`, so what follows the `?` is a query the server
  ignores.
- **Scoreboard**: replaces the Tab scoreboard's "USA, Arizona", which the client writes
  for every match a player does not host, with "Private server, <address>". A
  player-hosted match keeps its region.
- **Login**: sets the game's login parameters (`loaderInfo.parameters` `l` and `p`) to
  the nickname and server password once the start-up screens are past. Only those
  screens (`scripts/frame1.js`, `frame2.js`) talk to the official site, so they sent
  nothing.

The join runs in the page core, not in the dev console, so joining a private server
works with `dev_console` off.
