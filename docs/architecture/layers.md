# Layers, feature modules and the build

Status: **target design**. The refactor ([plan](../refactor/plan.md),
[progress](../refactor/progress.md)) moves the code here one step at a time. Until a
step is done, the old code under `desktop/`, `server/` and `tools/` still runs.

## Source tree

| Folder | Holds | May import |
|---|---|---|
| `src/shared/` | The wrapper ↔ console contract (route names, request and response schemas) and the feature catalog | nothing else in `src/` |
| `src/kernel/` | Cross-cutting pieces with no feature logic: config, flags, persistence, logging | `shared` |
| `src/wrapper/` | The Electron main process: the composition root, the `__dev/` router, platform (windows, protocol, sessions) | `shared`, `kernel`, the wrapper side of features |
| `src/console/` | The in-page dev console: the composition root and its kernel (registry, dispatch, UI, store, game adapter) | `shared`, `kernel` (browser-safe parts), the console side of features |
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

- esbuild bundles three entries into `dist/`: the wrapper (Node, `electron` external),
  the console (browser ESM) and the server (Node).
- The console bundle must add no global besides `pb2dev`, because the game's
  anti-tamper scan compares globals ([anticheat research](../research/anticheat.md),
  §6).
- Tests and tools run the TypeScript sources directly with Node's type stripping, so
  only erasable syntax is used: no `enum`, no `namespace`, no parameter properties.
