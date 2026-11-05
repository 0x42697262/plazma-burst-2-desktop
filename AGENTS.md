# Working on this repository

## Start here
- The rules: [docs/architecture/principles.md](docs/architecture/principles.md). §11
  lists the hard rules of this repository: feature flags, no single-letter names, no
  comments, no magic values.
- The code layout: [docs/architecture/layers.md](docs/architecture/layers.md). A new
  feature gets its folder in `src/features/`, its catalog entry and its doc in
  `docs/features/`.
- Docs index: [docs/README.md](docs/README.md).

## Working rules
- Commit only when the user asks. Commit messages carry no `Co-Authored-By` lines.
- Never commit local files: everything in `data/` except the `*.example.json`
  templates (settings, `credentials.json*`, `netlogs/`, `fingerprint*/`, `screenshots/`,
  the private server's `data/server/`), and `game*/`.
- Never print secrets. `data/netlogs/` and `data/credentials.json*` hold real logins.
- `game/` is downloaded game code (`npm run fetch-game`). Read it, never edit it.

## Confirmed facts
Each fact says where it was verified.
- The game runs JavaScript sent by its lobby server (RELIABLE_TASK) with `eval`, from
  the official server or any private server joined
  ([fingerprinting](docs/research/fingerprinting.md) §9).
- The game's anti-tamper scan compares globals and classes, not object methods
  ([anticheat](docs/research/anticheat.md) §6). Console code must add no globals
  besides `pb2dev`.
- Once a lobby server has connected, it broadcasts RELIABLE_VAR_SYNC to every client.
  Verified live; this cannot be derived from `game/`.

- Node 26 and Electron 45 (Node 24.22) run `.ts` ES modules directly, including
  `require()` from CommonJS. Verified 2026-11-02 ([ADR 0001](docs/adr/0001-typescript-esbuild.md)).

## Commands
- `npm run verify`: lint, type check, tests, console build. Must pass before every commit.
- `npm run smoke -- --run help --run "get speed"`: starts the real app, plays the
  official server from the launcher, and prints what each console line printed.

## Verification checklist
One line per behavior change: what to do, and the result to expect.
- Remote play redactor: `npm test`; the redactor case in `src/features/remote_play/domain.test.ts` hides a `docs/…` path
- Console bundle: `npm run smoke` prints the console's `help`, so the game page loaded `dist/page/` (page core and console).
- Page core: `npm test` (src/page/page-core.test.ts). `PB2_FEATURES=-dev_console,-server_list npx electron . --log-level=debug` loads `__dev/page/page.js` and no `console.js`; on a private server, a task is not run and the terminal shows a `[pb2]` line.
- Feature flags: `npm start -- --features` lists the flags. `PB2_FEATURES=-console_core npm start`
  stops with "cannot be turned off". `PB2_HOOKS=0 npm run smoke -- --run features`
  shows `hooks off env`.
- netlog: `npm test` (src/features/netlog/*.test.ts). In the game with `net_log on`, log in and run `netlog show type:authenticate`: the password part reads `‹redacted›`. `PB2_FEATURES=-netlog npm start`: `netlog` is an unknown command, and `__dev/netlog` answers 404.
- Map editor load: `npm test` (src/features/map_editor/map-editor.test.ts, src/features/map_cache/wrapper.test.ts). In a level, `editor on`, select a trigger, `editor export --to t`, change its `maxcalls` in data/maps/t.xml, then `editor load t`: "Loaded t: 1 replaced", and `editor undo` takes it back. `editor load t --add --here` adds a copy with a new uid at the crosshair. `editor load t --watch`, then save a change to the file: "Loaded t (changed)" within a second; `editor watch off` stops.
- server_list: `npm start` shows the list (from `dist/launcher/`). Save a server with a password, then change its address with Edit and leave the password empty: the row says "needs a password (Edit)", and the terminal says the password was dropped. `PB2_FEATURES=-server_list npm start` goes straight to the official game.
- lobby_task_guard: join a private server built from `src/server/` (`npm run server`). Nothing changes, because it sends no tasks. A server that sends a `RELIABLE_TASK` gets "It was not run" in the console, and the code never runs. `fingerprint list` still lists the official server's versions.
- login, cert_pinning: `npm test` (src/features/login, src/features/cert_pinning). `PB2_FEATURES=-login npm start`, then play the official server: the log says "Login is off" and the game is logged out. `PB2_FEATURES=-cert_pinning npm start`: a self-signed private server is refused.
- remote_play: `npm test` (src/features/remote_play). `npm run host`, then `npm run testers -- add me` and open the link: the game streams. `PB2_FEATURES=-remote_play npm run host` logs "Remote play is off" and quits.
- p2p_host: `npm test` (src/features/p2p_host). `npm run p2p-host` with `data/p2p-host.json` hosts as before. `PB2_FEATURES=-p2p_host npm run p2p-host` logs that the host is off and quits.
- Wrapper: `npm run smoke` plays the official server and the console answers; `npx electron . --host --port=8799` listens on 127.0.0.1; `npm start -- --features` lists the flags.
- Private server: `npm test` (src/server/server.test.ts starts the real server against the downloaded game and plays a match through it). `npm run server` prints the address, fingerprint and "Type \"help\"". Joining it from the game shows its match list at once, with no "Match listing error: Too fast" in chat.
- Free flight: `npm test` (src/features/movement/fly.test.ts). In a level, `fly free` and the movement keys glide you in all four directions; letting go slows you down; `fly on` still moves you only up and down.
- Tools: `npm run find-names -- --check` finds every name (230 of 230 for v1769098419); `npm run fetch-game -- --help` and `npm run fetch-opcodes -- --help` print their usage.
- client_sadburst: `npm test` (src/kernel/config/clients.test.ts). `npm run sadburst` starts Sad Burst 2 as before (its own session and settings file). `PB2_FEATURES=-client_sadburst npm run sadburst` logs "Sad Burst 2 is off" and quits. In a release AppImage, "Play Sad Burst 2" starts the app again as Sad Burst 2 instead of closing it (src/wrapper/platform/relaunch-options.test.ts).
- Editions: `npm test` (src/tools/build/editions.test.ts, src/kernel/editions). `npm run build -- --edition player` lists the added `lobby_task_guard` and `cert_pinning` and builds `dist/page/page.js` without `console.js`; `npm run build` builds everything again.
- Edition defaults: `npm test` (src/tools/build/edition-defaults.test.ts, src/features/server_list, src/wrapper/platform/kv-file.test.ts). `npm run build -- --edition <name>` with a server whose fingerprint is `"fetch"` stops and prints the fingerprint. A built edition with defaults, started with no `data/servers.json` and no settings file, logs that it added them; the server says "needs a nickname (Edit)".
- Releases: `npm test` (src/tools/release, src/features/game_setup). `npm run release -- --edition player --linux` writes `release/player/*.AppImage`; at its first start it downloads the game into `~/.config/<title>/game`, finds 229 names and opens the server list; playing the official server serves `__dev/page/page.js` and no console.
- Diagnostics: `npm test` (src/features/diagnostics). In the game console, `diagnostics report test` then `diagnostics show last` prints the report with secrets removed. `PB2_FEATURES=-diagnostics npm start`: `diagnostics` is an unknown command.
- Local data: `npm test` (src/kernel/data/move.test.ts). With files in an old place (`desktop/servers.json`), `npm start` says "Moved desktop/servers.json to data/servers.json" once, and the server list shows them. With both the old and the new file, it says which is used and leaves both.
