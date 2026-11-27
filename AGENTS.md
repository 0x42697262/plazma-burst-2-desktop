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

## Unmaintained research
`docs/research/fingerprinting.md`, `docs/research/anticheat.md` and
`docs/research/anticheat-sadburst.md` are no longer maintained and may not match the current
game. When you read, cite or rely on one of them, check the claim you used against `game/`
(or `game.sadburst/`) and follow "Reporting fixes" if it no longer matches.

## Reporting fixes
Prepare a pull request when you find one of these, in any task:
- A claim in an unmaintained research doc that no longer matches `game/` (or `game.sadburst/`).
- Code a game update broke: `npm run find-names -- --check` misses names,
  `Script.patch(...): found N times, expected M`, a hook is skipped, or `npm run smoke` fails.
- A bug in code outside your task.
- A page in `docs/features/` that no longer matches the code.

A bug inside your task is not reported: fix it as part of the task. Report only what you can
show: command output, or a file and line.

Do all the work first, at the end of your task, so the user only answers yes or no:
1. Search earlier reports: `gh issue list` and `gh pr list` with
   `--repo 0x42697262/plazma-burst-2-desktop --state all --search "<topic>"`. If an open pull
   request already fixes it, skip it.
2. Leave the user's working tree alone. Make a worktree:
   `git worktree add ../pb2-fix-<topic> -b fix/<topic> origin/main`, and link `node_modules`
   and the `game*/` folders into it from the main checkout.
3. Make the fix there. For a research doc, correct the text and cite the file and line in the game.
4. Run `npm run verify` there. If it fails and you cannot fix it, remove the worktree and
   prepare an issue instead: steps 5 and 6 still apply, with `gh issue create` in place of
   the pull request. Do the same when the fix is unclear or needs live testing.
5. Write the title and body fresh, in your own words: what was wrong, the evidence, what you
   changed, the game build from `game/pb2-version.json`, how you verified it, and a
   "Related" line listing the earlier reports as `#<number>`. Never reuse a fixed title or body.
6. Ask one question. Show the title, the body and `git diff --stat`, then ask:
   "Open this pull request? (yes/no)", or "Open this issue? (yes/no)". For an issue, a yes
   runs `gh issue create --repo 0x42697262/plazma-burst-2-desktop --title "…" --body-file <file>`
   and prints the link.

On yes, finish without asking again; the yes is the user asking you to commit:
1. Stage only the files you changed, by name. Never the links from step 2, `data/` or `game*/`.
2. Commit, run `git push -u origin fix/<topic>` (with no push access, `gh repo fork --remote`
   first and push to the fork), then
   `gh pr create --draft --repo 0x42697262/plazma-burst-2-desktop --title "…" --body-file <file>`.
3. Print the link. If `gh` is not set up, push anyway and print
   https://github.com/0x42697262/plazma-burst-2-desktop/compare/fix/<topic>?expand=1.
4. Remove the worktree.

On no, remove the worktree and the branch, then go on.

Ask at most twice per session. Put any further findings into the second pull request.

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

- `sadburst2.com/gameplay_erich5/` plays the official lobby (`https://vvvv.` + `plazmaburst2.com`) with
  official accounts, and its scripts hold no `PB2_CLIENT_BUILD`, so it sends no build hash.
  Verified 2026-11-16 in `game.sadburst-erich5/gamelogic/` ([client-sadburst](docs/features/client-sadburst.md)).

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
- Tools: `npm run find-names -- --check` finds every name (247 of 247 for v1769098419); `npm run fetch-game -- --help` and `npm run fetch-opcodes -- --help` print their usage; `npm run protocol` prints every reliable message with its opcode line, dispatch line and send sites.
- client_sadburst: `npm test` (src/kernel/config/clients.test.ts). `npm run sadburst` starts Sad Burst 2 in its own session; `profile list` and `bind` show the same as in the official client (one `data/dev-overrides.json`), `fingerprint list` shows only Sad Burst 2's. `PB2_FEATURES=-client_sadburst npm run sadburst` logs "Sad Burst 2 is off" and quits. In the launcher, choosing Sad Burst 2 in the Game list and pressing Play opens Sad Burst 2 in the same process, and "Servers > Server list" returns to the launcher with no restart.
- client_sadburst_erich5: `npm test` (src/kernel/config/clients.test.ts, src/features/login, src/features/server_list). `npm run fetch-game -- --sadburst-erich5` ends with "Found 246 of 246 names" (build 20261108195354). `npm run sadburst-erich5` opens the launcher with Sad Burst 2 (official servers) chosen in the Game list and PlazmaBurst2.com as its first row; with an official account active, Play on the first row loads Sad Burst's entry screen with that login and the password filled in. `PB2_FEATURES=-client_sadburst_erich5 npm run sadburst-erich5` logs "is off" and quits.
- settings_guard: `npm test` (src/features/settings_guard). In the game, `bind f js 1` opens a native dialog listing `bind f: js 1`; Refuse prints "Not saved" and `bind` no longer lists f; Keep saves it. `bind g heal` saves with no dialog. `PB2_FEATURES=-settings_guard npm start`: `bind f js 1` saves with no dialog.
- fps: `npm test` (src/features/fps). `npm run smoke -- --level data/maps/<map>.xml --run "fps 60 high" --run fps` prints `FPS 60, physics high, logic …`; the Esc menu shows 60 and high. `PB2_FEATURES=-fps`: `fps` is an unknown command.
- fly sweep: `npm test` (src/features/movement/fly.test.ts). In a level, `fps 60 high` then `fly sweep --on`: you go limp (it holds X) and rise while the crosshair and camera stay still; `fly sweep --off` lets go. `fly sword --on` with swords out also holds the mouse button and swings. By default (`--directional`) the cursor above you lifts you and the side it is on is held (A or D); `fly sweep --plain` is the plain sweep, `--up` only goes up wherever the cursor is, `--inverse` only mirrors the height, `--default` goes back to directional. With `fly_sweep_throttle edge` (the default) the cursor on you does nothing and at the screen edge flies fastest; `fly_sweep_throttle near` is the old behavior; `fly_sweep_measure distance` makes 400 units from you full speed at any zoom. With the cursor to your right, the directional swing aims left of you, above and below in turn. `fly_sweep_ragdoll 0`: the sweep leaves X to you; `0.5` holds it every other tick. `fly_sweep_shoot on` with a gun: holding the left button fires at the cursor while you keep sweeping. `fly free` and `fly on` work as before.
- Hold binds and mouse buttons: `npm test` (src/features/binds/hold.test.ts, src/console/kernel/commands/hold.test.ts). In a level, `bind --hold mouse2 "fly sweep"` with `fps 60 high`: holding the right button sweeps, letting go stops it, and the game does not see the button; `bind --hold f heal` is refused; `bind` lists `mouse2 (hold)`. `bind --pass mouse1 heal`: clicking still shoots and heals; `bind` lists `mouse1 (pass)`.
- Toggle binds: `npm test` (src/features/binds/toggle.test.ts, src/console/kernel/commands/toggle.test.ts, src/features/settings_guard/settings-guard.test.ts). In a level, `bind --toggle shift+f "fps 60 high unlimited" "fps 30 low match"`: each press cycles through the commands and wraps around; `bind` and `list binds` mark it `(toggle)`; `bind --toggle --hold` is refused; a toggle holding a risky command (such as `js` or `triggers exec`) still triggers `settings_guard`, whose dialog shows the steps unescaped; `bind --toggle f "js f("a;b")" "heal"` is refused with "quotes are not closed".
- Map cache on Sad Burst 2 for the official servers: `npm test` (src/features/map_cache/wrapper.test.ts). With `fast_maps on`, in the erich5 client a map already in data/maps loads without a download, and a new one is saved to data/maps.
- free_camera: `npm test` (src/features/free_camera). In a level, `freecam`: W A S D pan the view and your character stands still, Shift is faster, a middle drag drags the map, `freecam` again hands the camera back. `bind --hold f4 freecam` works while F4 is held. In an approved match it is refused unless `bypass checks`. `PB2_FEATURES=-free_camera npm start`: `freecam` is unknown.
- Smoke for every client: `npm run smoke -- --client sadburst_erich5 --run guns` lists the same guns as `npm run smoke -- --run guns`; `npm run smoke -- --level data/maps/<map>.xml --run pos` prints `you: …`.
- Neutral launcher: `npm test` (src/features/server_list). `npm start` shows no "Game … from" line until Play is pressed. `npm run sadburst` opens the launcher with Sad Burst 2 chosen; the Game list and "Servers > Server list" move between the three clients without restarting the app.
- Server list in every client: `npm test` (src/features/server_list, src/kernel/flags). `npm run sadburst` opens the list with Sad Burst 2 as its first row; joining a private server there removes `auth_token` from the page first, and in erich5 `pb2_saved_login` and `pb2_saved_password` (src/features/login/login.test.ts).
- Editions: `npm test` (src/tools/build/editions.test.ts, src/kernel/editions). `npm run build -- --edition player` lists the added `lobby_task_guard` and `cert_pinning` and builds `dist/page/page.js` without `console.js`; `npm run build` builds everything again.
- Edition defaults: `npm test` (src/tools/build/edition-defaults.test.ts, src/features/server_list, src/wrapper/platform/kv-file.test.ts). `npm run build -- --edition <name>` with a server whose fingerprint is `"fetch"` stops and prints the fingerprint. A built edition with defaults, started with no `data/servers.json` and no settings file, logs that it added them; the server says "needs a nickname (Edit)".
- Releases: `npm test` (src/tools/release, src/features/game_setup). `npm run release -- --edition player --linux` writes `release/player/*.AppImage`; at its first start it downloads the game into `~/.config/<title>/game`, finds 231 names and opens the server list; playing the official server serves `__dev/page/page.js` and no console.
- Release hardening: `npm test` (src/tools/release/config.test.ts, src/wrapper/platform/release-lockdown.test.ts). `npm run release -- --edition player --linux`, then `npx @electron/fuses read --app release/player/linux-unpacked/<binary>` shows RunAsNode and the inspect options disabled; starting that binary with `--remote-debugging-port=9555` opens no port, unless the edition says `"devtools": true`. The release prints "Compiled the main process to V8 bytecode", its asar holds `dist/wrapper/main.jsc` beside a small loader `main.cjs`, and the app starts (src/tools/release/bytecode.test.ts).
- Obfuscation: `npm test` (src/tools/build/obfuscate.test.ts, src/features/hooks/hooks.test.ts runs every hook test on the obfuscated runtime too). An edition with `"obfuscate": true`, built with `npm run build -- --edition <name>`, prints "Obfuscated N files" and leaves no `*.map` in `dist/`; `node src/tools/smoke/cli.ts --run help --run hooks` on that build answers `help` and lists the hooks as loaded.
- Diagnostics: `npm test` (src/features/diagnostics). In the game console, `diagnostics report test` then `diagnostics show last` prints the report with secrets removed. `PB2_FEATURES=-diagnostics npm start`: `diagnostics` is an unknown command. With `PB2_DIAGNOSTICS_URL=http://127.0.0.1:9999/r` and a listener there, `diagnostics send` posts the report and empties the queue; `diagnostics send preview` sends nothing. `npm run build -- --edition diagnostics` leaves the command out of `dist/page/`; `npm run build` builds everything again.
- Diagnostics: `npm test` (src/features/diagnostics). In the game console, `diagnostics report test` then `diagnostics show last` prints the report, the password as it came. `PB2_FEATURES=-diagnostics npm start`: `diagnostics` is an unknown command. With `PB2_DIAGNOSTICS_URL=http://127.0.0.1:9999/r` and a listener there, `diagnostics send` posts the report and empties the queue; `diagnostics send preview` sends nothing. With `PB2_DIAGNOSTICS_KEY=<kid>:<base64 X25519 public key>`, `diagnostics config` says `Encryption: on` and a listener holding the private key reads the report out of `schemaVersion: 2`; a key that is not 32 base64 bytes sends nothing. `npm run build -- --edition diagnostics` leaves the command out of `dist/page/`; `npm run build` builds everything again.
- Accounts: `npm test` (src/features/login). `npm start`, select the official server: the panel lists your accounts, and "Log in to a new account" opens the site; after logging in it closes and the account is listed. Select the Sad Burst 2 row: the same panel with a form. Select a private server: no panel. `data/credentials*.json` holds no plain secret.
- Map bot: `npm test` (src/features/map_bot, src/server/maps.test.ts). With `"map_sources": ["official_lobby"]` and `PB2_MAP_BOT_ACCOUNT` set to an account file, `npm run server` logs "Map bot: maps that are not here are fetched from the official lobby"; creating a match on a map not in `data/maps` logs "fetching … from the official lobby", then "downloaded and saved". `PB2_FEATURES=-map_bot npm run server` stops with "official_lobby is not in this server".
- map_update: `npm test` (src/features/map_update, src/server/maps.test.ts). On a server with `download_maps` on, an admin in a match types `-mapupdate`: a line only they see says "Updated <map>. \"-mapupdate now\" reloads this match", and `data/maps/<map>.xml` is the new version; `-mapupdate now` shows "This map was updated by <admin>: reloading" to the match and reloads it. In the terminal, `maps update #1 now` does the same for match 1; a map that is not published keeps the saved copy. `PB2_FEATURES=-map_update npm run server`: `maps` is an unknown command.
- Web client: `npm test` (src/features/web_client). After building a server edition, `npm run server` warns about no page bundle only if `dist/web/page/page.js` is missing; opening the server's address shows the join form, and Play loads the game, which connects to this server only (its response carries `connect-src 'self'`). `PB2_FEATURES=-web_client npm run server`: `/` answers 404.
- Server editions: `npm test` (src/tools/build/server-edition.test.ts). `npm run build -- --edition server` prints its server and web parts and builds `dist/server/server.cjs` and `dist/web/page/`; `node dist/server/server.cjs` runs without the source tree. `npm run release -- --edition server --public-url https://pb2.example.com` writes `release/server/server/` (no `.map`, no game unless `include_game`) and `release/server/server.tar.gz`.
- Local data: `npm test` (src/kernel/data/move.test.ts). With files in an old place (`desktop/servers.json`), `npm start` says "Moved desktop/servers.json to data/servers.json" once, and the server list shows them. With both the old and the new file, it says which is used and leaves both.
- player_info accounts: `npm test` (src/features/player_info/accounts.test.ts). In a match,
  `accounts` prints one row per connected player and spectator with nickname, login and auth id
  (a spectator tagged `(spectating)`), and that id is the one `ENDORDSE_USER` carries in
  `netlog show`. A bot shows `-` for its login and auth id; offline, `accounts` says
  "Not in a match". `PB2_FEATURES=-player_info.accounts npm start`: `accounts` and `ids` are
  unknown commands, and `chars` still answers.
- reputation: `npm test` (src/features/reputation). In the multiplayer lobby, `rep` prints "Reputation N (potential M)" and the skill, wins and losses the lobby screen shows; `rep relations` lists each relation as fit or unfit, from -> to, its delta and how long it lasts, like the lobby's Relations screen; in a match, `rep players` lists everyone with the Rep. column's numbers, bots as `-`. Before the lobby login both lobby commands say "not logged in to the lobby server yet". In the official client, after logging in, `rep device` shows `Device id: <four base-36 numbers>`, the first account on the save, and "<account>'s network save was loaded at start and carried this id" (or that it carried none). `PB2_FEATURES=-reputation npm start`: `rep` is an unknown command.
- network_save: `npm test` (src/features/network_save, src/kernel/game-save). Logged in, `netsave` names the page's account and lists "game download for <account>" from the start; `netsave preview` lists the values the next upload sends with `first_login_proof = ‹hidden›`; `netsave diff` and `netsave download` write nothing. `netsave upload` only says what it would do; `netsave upload --yes` from the Esc menu says "The game uploaded the save" and `netsave backups` then lists an online backup "before an upload" in `data/netsaves/` (mode 600). `netsave restore` warns when the device id would change. `netsave fields vol` lists the matching fields typed; `netsave set music_vol 0.5` says it backed up the local save and prints `music_vol = 0.5  (was …)`; `PB2_FEATURES=-network_save npm start`: `netsave` is an unknown command and `rep device` is off.
- player_info chars filters: `npm test` (src/features/player_info/chars.test.ts). In a team
  match, `chars alpha` lists only team Alpha, `players` lists no bots, `bots blue` lists
  Blue Team's bots, and `chars zzz` is an error that lists the filters.
- wire: `npm test` (src/features/wire/*.test.ts). In a match, `wire heal_player target=bob
  power=5 --dry` shows `power 5 -> 500` and the picked target and sends nothing; `wire hit_player`
  with no target aims at the nearest within `wire_radius`; `wire list` lists 44 messages;
  `wire help hit_player` lists its fields; `wire heal_player --dry` picks the ally nearest the crosshair, not an enemy under it, and
  `target=enemy:near:3` picks the 3 closest enemies; `wire task` is refused as receive-only; `wire
  authenticate` needs `--force`. With `net_log on`, `wire enter_respawn_queue` shows a numeric reply
  id in `netlog show` and its answer in the console; `wire report_user` in the menu asks for an
  auth id instead of failing. `wire help <message>` starts with what the message does, has a `field type default meaning`
  header with defaults in words, a `what to put` column, and `required` where there is none, ends with an `example:` line, and a message
  relayed to every other client prints a note that your own screen does not change. `PB2_FEATURES=-wire` makes `wire` unknown;
  `PB2_FEATURES=-wire.match` refuses match messages but still sends lobby ones. The table
  matches docs/research/protocol.md (src/features/wire/domain/table.test.ts).
