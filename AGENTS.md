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
- P0.2: `npm test`; the redactor case in `test/remote.test.mjs` hides a `docs/…` path
- P1: `npm run smoke` prints the console's `help`, so the game page loaded the `dist/console/` bundle.
