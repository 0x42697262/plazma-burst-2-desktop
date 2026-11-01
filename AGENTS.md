# Working on this repository

## Start here
- The rules: [docs/architecture/principles.md](docs/architecture/principles.md). §11
  lists the hard rules of this repository: feature flags, no single-letter names, no
  comments, no magic values.
- A refactor is in progress. Read
  [docs/refactor/progress.md](docs/refactor/progress.md), take the first unchecked
  step, and follow [docs/refactor/plan.md](docs/refactor/plan.md). Tick the step when
  it is done.
- Docs index: [docs/README.md](docs/README.md).

## Working rules
- Commit only when the user asks. Commit messages carry no `Co-Authored-By` lines.
- Never commit local files: `desktop/*.json` settings, `desktop/credentials.json*`,
  `desktop/dev-overrides.json.bak`, `netlogs/`, `fingerprint*/`, `screenshots/`,
  `game*/`.
- Never print secrets. `netlogs/` and `desktop/credentials.json*` hold real logins.
- Behavior stays the same during the refactor unless a plan step says otherwise.
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
- P0.2: `npm test`; the redactor case in `src/features/remote_play/domain.test.ts` hides a `docs/…` path
- P1: `npm run smoke` prints the console's `help`, so the game page loaded the `dist/console/` bundle.
- P2: `npm start -- --features` lists the flags. `PB2_FEATURES=-zoom npm start` stops
  with "cannot be changed yet" (until `zoom` is migrated). `PB2_HOOKS=0 npm run smoke -- --run features`
  shows `hooks off env`.
- P3.1: `npm test` (src/features/netlog/*.test.ts). In the game with `net_log on`, log in and run `netlog show type:authenticate`: the password part reads `‹redacted›`. `PB2_FEATURES=-netlog npm start`: `netlog` is an unknown command, and `__dev/netlog` answers 404.
- P3.2: `npm start` shows the list (from `dist/launcher/`). Save a server with a password, then change its address with Edit and leave the password empty: the row says "needs a password (Edit)", and the terminal says the password was dropped. `PB2_FEATURES=-server_list npm start` goes straight to the official game.
- P3.3: join a private server built from `server/`. Nothing changes, because it sends no tasks. A server that sends a `RELIABLE_TASK` gets "It was not run" in the console, and the code never runs. `fingerprint list` still lists the official server's versions.
- P3.18: `npm test` (src/features/login, src/features/cert_pinning). `PB2_FEATURES=-login npm start`, then play the official server: the log says "Login is off" and the game is logged out. `PB2_FEATURES=-cert_pinning npm start`: a self-signed private server is refused.
- P3.19: `npm test` (src/features/remote_play). `npm run host`, then `npm run testers -- add me` and open the link: the game streams. `PB2_FEATURES=-remote_play npm run host` logs "Remote play is off" and quits.
- P3.20: `npm test` (src/features/p2p_host). `npm run p2p-host` with `desktop/p2p-host.json` hosts as before. `PB2_FEATURES=-p2p_host npm run p2p-host` logs that the host is off and quits.
- P4.3: `npm run smoke` plays the official server and the console answers; `npx electron . --host --port=8799` listens on 127.0.0.1; `npm start -- --features` lists the flags.
- P5.1: `npm test` (src/server/server.test.ts starts the real server against the downloaded game and plays a match through it). `npm run server` prints the address, fingerprint and "Type \"help\"".
- P5.2: `npm run find-names -- --check` finds every name (226 of 226 for v1769098419); `npm run fetch-game -- --help` and `npm run fetch-opcodes -- --help` print their usage.
- P3.21: `npm test` (src/kernel/config/clients.test.ts). `npm run sadburst` starts Sad Burst 2 as before (its own session and settings file). `PB2_FEATURES=-client_sadburst npm run sadburst` logs "Sad Burst 2 is off" and quits.
