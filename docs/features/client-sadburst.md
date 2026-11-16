# client_sadburst, client_sadburst_erich5

Feature flags `client_sadburst` and `client_sadburst_erich5` (on by default; all modes), one
per client. The client map:
`src/shared/clients/keys.ts` (what the page may know: titles, hosts, page prefix,
settings file name, session partition, run flags) and `src/kernel/config/clients.ts` (the
same plus the game, names and opcodes files). The gate: `src/wrapper/app.ts`.

## The three clients
- `official`: Plazma Burst 2, `www.plazmaburst2.com/h5/versions/<version>/`, the default
  everywhere.
- `sadburst`: Sad Burst 2, `sadburst2.com/gameplay/`, a community fork of the official
  client with its own servers and accounts. Same obfuscated names, but bundled and
  minified, and loaded from a manifest of hashed script files. Only its game page is
  served from `game.sadburst/`; the rest of its site (login, API) is the network's.
  Its anti-cheat and how it differs from the official one:
  [anticheat-sadburst](../research/anticheat-sadburst.md).
- `sadburst_erich5`: Sad Burst 2 for the official servers, `sadburst2.com/gameplay_erich5/`
  (flag `--sadburst-erich5`, feature `client_sadburst_erich5`). It is built from the same code
  as `/gameplay/` (97% of the obfuscated names in the main script are the same), so the
  names, the downloader and `find-names` are the Sad Burst ones. What differs:
  - **Servers and accounts are the official ones.** Its scripts build the lobby address
    `https://vvvv.` + `plazmaburst2.com` and call `www.plazmaburst2.com/pb2/server.php`;
    the Sad Burst lobbies (`ca/cn.sadburst2.com:2053`) are not in its code.
  - **Its entry screen** (`scripts/gameEntry.js`, no Vue) reads `pb2_saved_login` and
    `pb2_saved_password` from localStorage and hands them to the game as `loaderInfo.parameters.l`
    and `.p`, the same two values the official client reads from the `login` and `password`
    cookies. So the app uses the official account book: the page starts with those two keys set
    to the active account's login and its md5 password cookie (a script before the game's own,
    `gateStartupScript` in `src/features/login/wrapper.ts`), and you press Start Game. With no
    active account the screen is left alone.
  - **No build hash.** Its loader never computes `PB2_CLIENT_BUILD`; nothing in its code
    sends one.
  - Its own session (`persist:sadburst-erich5`), settings (`dev-overrides.sadburst-erich5.json`),
    game folder (`game.sadburst-erich5/`), names, opcodes, maps and fingerprints, all named
    `*.sadburst-erich5*`. The game version is `erich5-<build>`; the page tells the clients
    apart by that prefix (`clientOfVersion`).

## Choosing one
- Every command is for the official client unless asked:
  `npm run fetch-game -- --sadburst`, `npm run find-names -- --sadburst`,
  `npm run sadburst` (`electron . --sadburst`); for the third client
  `npm run fetch-game -- --sadburst-erich5`, `npm run find-names -- --sadburst-erich5`,
  `npm run sadburst-erich5`. Running the usual commands never touches the Sad Burst files.
- Inside the app: the server list has a row for every other client (select it to choose an
  account; Play starts it), and the Game menu (Alt) lists all of them. Choosing one starts the
  app again with its flag (`src/wrapper/platform/relaunch.ts`, `argsForClient` in
  `src/kernel/config/clients.ts`), which is how an installed app switches. An AppImage
  starts again from the file in `APPIMAGE` (`src/wrapper/platform/relaunch-options.ts`):
  its running binary sits in a mount that closes when the app quits. With
  `client_sadburst` off (or left out of the edition), only the official client is
  offered; each client has its own flag (`feature` in `src/shared/clients/keys.ts`).
- The `--` passes the flag to the script: npm 12 refuses
  `npm run fetch-game --sadburst` as an unknown npm option, and older npm turns it into
  `npm_config_sadburst` ("true", or "" on some versions), which is read too ("false" and
  "0" do not count); for `--sadburst-erich5` it is `npm_config_sadburst_erich5`. The one
  reader is `clientOf` in `src/kernel/config/environment.ts`.

## Kept apart
- Sad Burst 2 keeps everything apart from the official client: its own settings file
  (`data/dev-overrides.sadburst.json`), names and opcodes files, game folder and
  browser session (`persist:sadburst`). Its lobby can run code in its page
  (RELIABLE_TASK, [fingerprinting](../research/fingerprinting.md) §4), and nothing it
  writes may reach the official client, e.g. a bind running `js ...` in the official
  game, signed in with your official account.
- Sad Burst 2 (`/gameplay/`): hooks are in the flag's hands like everywhere else, but its
  loader sends a hash of the game scripts, as the page receives them, with the login, so a hook
  that changes a script changes that hash ([hooks](hooks.md),
  [anticheat-sadburst §12](../research/anticheat-sadburst.md#12-the-client-build-hash)).
  Erich5 sends no hash.
- Erich5's lobby is the official one: it can run code in the page (RELIABLE_TASK) and it is
  logged in with the official account's md5, kept only in the page's localStorage of its own
  session. Joining a private server removes the entry screen's two saved values and, for
  Sad Burst 2, the `auth_token`, before the game's scripts run (`privateServerScript`), so a
  private server never receives them; they are set again the next time the client's own
  servers are played.
- Remote play and the player-hosted host are for the official client only.

## The server list
Every client has the server list (`server_list`). Its first row is the running client's own
servers: Sad Burst 2's lobby for Sad Burst 2, the official ones for the official client and
for erich5. The other clients follow as rows. A private server is joined the same way in
every client (`lobbyHosts`, `lobbyPort` and the login parameters, [server-list](server-list.md));
whether a match then plays depends on the client: the lobby connection is made, a client
whose game code differs may fail later, when the match starts.

## The flags
- With `client_sadburst` off, `npm run sadburst` logs that Sad Burst 2 is off and quits;
  with `client_sadburst_erich5` off, `npm run sadburst-erich5` does the same for erich5. The
  official client is not affected. The download and names tools are not gated.
