# Layers, feature modules and the build

Everything that runs is under `src/`. `data/` holds only local data: settings,
credentials, saved maps, logs, the generated `names.js` and `opcodes.js`, and in
`data/server/` the private server's settings and data
([running](../operations/running.md#local-data)).

## Source tree

| Folder | Holds | May import |
|---|---|---|
| `src/shared/` | The wrapper ↔ console contract (route names, request and response schemas) and the feature catalog | nothing else in `src/` |
| `src/kernel/` | Cross-cutting pieces with no feature logic: config, flags, persistence, logging | `shared` |
| `src/wrapper/` | The Electron main process: the composition root, the `__dev/` router, platform (windows, protocol, sessions) | `shared`, `kernel`, the wrapper side of features |
| `src/page/` | The page core: what every game page needs to play safely (the lobby task guard, the private-server join client), the game-ready wait and the report channel | `shared`, `kernel`, the console's game adapter (`src/console/kernel/game/`, `net/`), the page side of features |
| `src/console/` | The in-page dev console: the composition root and its kernel (registry, dispatch, UI, store, game adapter) | `shared`, `kernel` (browser-safe parts), the console side of features |
| `src/server/` | The private lobby server (`npm run server`): config, maps, the game server's stand-ins, TLS and the terminal | `shared`, `kernel`, `tools/find-names` |
| `src/tools/` | Command-line tools: build, fetch-game, find-names, fetch-opcodes, redact-netlogs, smoke, the ESLint rules | `shared`, `kernel`, `features` |
| `src/features/<id>/` | One feature: `console.ts`, `wrapper.ts`, `domain/`, `services/`, `adapters/`, `entry/`, `constants.ts`, `text.ts`, `events.ts`, `keys.ts`, tests | `shared`, `kernel`, the console or wrapper kernel of its side, other features only through their `index.ts` |

## Inside a feature

- `domain/`: pure functions and types. Nothing in it reads the clock, the environment,
  files, the network or the game; anything like that is passed in.
- `services/`: one use case each, calling domain functions and adapters.
- `adapters/`: files, `fetch`, the Electron API, the game adapter.
- `entry/`: console commands, `__dev/` routes and ticks. Each validates its input,
  calls one service and shapes the output.

## Wiring

- `src/wrapper/features.ts` and `src/console/features.ts` are the only lists of
  features: the one wiring place per side.
- Each composition root keeps the features whose flag is on and whose `availableIn`
  includes the current mode (local, remote, server). It then registers their routes,
  commands, ticks and frame hooks.
- A feature that is off registers nothing: no `help` entry, routes answer 404, its
  ticks never run.

## Build

- esbuild (`src/tools/build/`) bundles what runs in a browser or needs CommonJS: the
  page scripts into `dist/page/` in one run with code splitting: `page.js` (the page
  core, from `src/page/index.ts`), `console.js` (the dev console, from
  `src/console/index.ts`) and the `chunks/` they share, so shared modules load once; the
  server list page and its preload into `dist/launcher/`, the hooks runtime into
  `dist/hooks/runtime.cjs`, and the remote-play client into `dist/remote-client/`; see
  [ADR 0001](../adr/0001-typescript-esbuild.md). The wrapper (`src/wrapper/main.ts`),
  the server, the tools and the tests run the `.ts` sources directly.
- The page scripts must add no global besides `pb2dev`, because the game's
  anti-tamper scan compares globals ([anticheat research](../research/anticheat.md),
  §6).
- Tests and tools run the TypeScript sources directly with Node's type stripping, so
  only erasable syntax is used: no `enum`, no `namespace`, no parameter properties.

## The wrapper

- `src/wrapper/main.ts` prints `--features` or starts `src/wrapper/app.ts`, the
  composition root: it builds the context (environment, flags, logger) once, refuses a
  start mode whose flag is off, builds the wrapper sides of the features, and answers
  every request of a game page (`handleRequest`): features' interceptors first, then the
  `__dev/` routes and files, then the game files, then the network.
- `src/wrapper/platform/` holds what is Electron or file plumbing rather than a feature:
  the settings file sync (`kv-file.ts`), index.html preparation (`index-page.ts`), game
  files (`game-files.ts`), `__dev/` files and start checks (`dev-files.ts`), the page
  log, the remote-play windows and the dedicated host's window.

## The console

- `src/console/index.ts` registers every command (`kernel/commands/register-all.ts`),
  builds the panel and starts the frame loop once the game's stage exists.
- `src/console/kernel/` is the console's core, flagged `console_core` (it cannot be
  turned off): `core/` (words, options, colors, the page's mode), `game/` (the only
  code that touches the game's obfuscated globals), `state/` (settings, binds, history,
  profiles), `overrides/` (what is forced every frame), `ui/`, `commands/` and
  `dispatch.ts`.
- The page's flags come from the wrapper (`PB2_FEATURES`, read-only); `src/console/flags.ts`
  reads them.
