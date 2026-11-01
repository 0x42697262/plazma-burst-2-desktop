# Refactor progress

The plan is [plan.md](plan.md). Take the first unchecked step and follow its
**test first** and **done when** lines. Run `npm run verify` (`npm test` before P1),
tick the step here, and note anything the next session must know under the step.

## P0. Docs scaffold
- [x] P0.1 `docs/` layout, principles, layers, feature flags, ADRs 0001–0004, plan, this file
- [x] P0.2 Research and guide docs moved into `docs/`; every reference in code, tests and docs updated; remote play also hides `docs/` paths
- [x] P0.3 `AGENTS.md`

## P1. Toolchain
- [x] P1.1 Dev deps pinned (typescript, esbuild, eslint, typescript-eslint, @types/node), zod
- [x] P1.2 `tsconfig.json`
- [x] P1.3 `src/tools/build/` bundles the console only (`--watch`); the rest runs `.ts` directly (ADR 0001)
- [x] P1.4 Console served from `dist/console/`; `src/kernel/config/paths.ts`; `npm run smoke` (`src/tools/smoke/`) drives the real app
- [x] P1.5 ESLint config + local rules `no-comments`, `no-literal-strings` (with tests)
- [x] P1.6 Scripts `build`, `check`, `lint`, `test`, `verify`
- [x] P1.7 `.gitignore`: `/dist/`, `/features.json`
- [ ] P1 tests: the bundle boots in the fake game; no new globals besides `pb2dev`

Notes for later steps:
- New code lives in `src/` (ES modules). The old `tools/` and `server/` move to
  `src/tools/` and `src/server/` in P5, not to `tools/*.ts`.
- The console tests still import the console sources; `test/fake-game.mjs`
  `bootConsole({ entry })` can boot a built bundle instead.

## P2. Kernel
- [x] P2.1 `src/shared/contract/routes.ts` replaces `desktop/dev/console/shared.json`
- [x] P2.2 `src/kernel/config/{env,settings}.ts`; every `process.env`/`process.argv` read moved there
- [x] P2.3 Feature catalog, `resolve()`, `features.json` adapter
- [x] P2.4 `src/kernel/persist/{versioned,serial}.ts`
- [x] P2.5 `src/kernel/log/` structured logger and events catalog
- [x] P2.6 Composition roots (wrapper, router, console) with fallback to the old code; `allowedHere` from the catalog
- [x] P2.7 `features` console command and `--features` start flag

Notes from P2 for the feature steps:
- The wrapper starts at `src/wrapper/main.ts`. `src/wrapper/context.ts` builds the
  environment, the flags and the log once, and stops the app on any problem. The old
  `desktop/main.js` reads them from there (`ENVIRONMENT`, `FLAGS`, `log`).
- To migrate a feature:
  - add its wrapper side (`WrapperFeature`, `src/wrapper/feature-types.ts`) to
    `src/wrapper/features.ts`; its routes are served before the old `serveDev`;
  - add its console side (`ConsoleFeature`, `src/console/feature-types.ts`) to
    `src/console/features.ts`; its commands are registered after the old ones, its
    frame hooks run first, its ticks get their own interval;
  - set `migrated: true` in `src/shared/features/catalog.ts`.
- An old command definition can already be gated with `feature: '<id>'`
  (`allowedHere`, `desktop/dev/console/core/remote.js`).
- The guard against code from a private lobby is the flag `lobby_task_guard` (on by default; off lets a private lobby run code, as before). It was planned as `private_lobby_tasks` (off by default), renamed so that on means the code runs, like every other flag.
- An unknown log level now stops the app at start; it used to be a warning.

## P3. Feature migrations
- [x] P3.1 `netlog` + security fix 1 (AUTHENTICATE, JOIN_MATCH, CREATE_MATCH passwords redacted; `npm run redact-netlogs`, not run on the user's logs: ask first)
  - Settings keys `net_log`, `net_log_state`, `net_log_all` are still defined in the old
    `desktop/dev/console/state/schema.js`. Features contributing their own keys to the
    schema is part of P4.1.
  - The command now appears at the end of `help`, after the old commands; help order
    follows registration.
  - Test helpers: `test/support/net-protocol.mjs` (encNum, netMsg, netPacket,
    fakeConnection) and the `.d.mts` declarations for the test helpers.
  - A test that imports a module reading `game/names.js` must import it after
    `bootConsole()` (dynamic import).
- [x] P3.2 `server_list` + security fix 2 (password dropped when address or pin changes; `servers.json` versioned, mode 0600)
  - The launcher page and its preload are TypeScript, bundled to `dist/launcher/` by
    `npm run build`. `desktop/main.js` loads `LAUNCHER_PAGE`/`LAUNCHER_PRELOAD` from
    the feature.
  - `src/wrapper/features.ts` is now `buildWrapper(deps, ports)`. Ports are what the old
    `main.js` provides (the window, the login session), until P4.3 moves them.
  - The server list is now local-mode only in the catalog. Before, the p2p host had the
    `servers` command, and every operation answered 403.
  - HTTP methods and status codes are in `src/shared/contract/keys.ts`, used by both
    sides.
- [x] P3.3 `fingerprint` + `lobby_task_guard` + `net/tap` + security fix 3 (no RELIABLE_TASK from private lobbies)
  - The guard sits on the connection class's prototype (`connClass`), so it is in place
    before the first lobby packet. The kernel `tap` gained `rewriteArguments`, and the
    codec gained `escField`, `escPart` and `joinParts`.
  - The capture skips private lobbies; `fingerprint/index.json` is versioned.
  - The game-network adapter moved to `src/console/kernel/game/network.ts`, and the
    timestamp to `src/kernel/time/stamp.ts`. `withQuery` is in `src/shared/contract/routes.ts`.
  - `src/features/server_list/index.ts` exposes `pageJoinTarget` and
    `isJoiningPrivateServer` to other features.
- [x] P3.4 `screenshot`
- [x] P3.5 `js_eval`
- [x] P3.6 `zoom` (features add `list` sections through `listSections`)
- [x] P3.7 `game_chat`
- [x] P3.8 `trace`
  - Integration tests moved from `test/console.test.mjs` go to the feature folder as
    `*.test.mjs`, one shared `bootConsole()` per file
    (`tools`: the scratchpad move script is not kept; the pattern is the header of
    `src/features/trace/trace.test.mjs`). Converting them to TypeScript is P6.1.
- [x] P3.9 `profiles` (the store ignores profiles while the flag is off)
- [x] P3.10 `binds` (saved binds do not run while the flag is off; `commandText`/`warnKeyUses` are in the console kernel)
- [x] P3.11 `guns`
- [x] P3.12 `player` (the per-frame player overrides follow the flag)
- [x] P3.13 `scan_bypass` (the protection stays in the console; with the flag off it cannot be turned off)
- [x] P3.14 `map_cache` (wrapper features can intercept requests outside `__dev/` with `interceptors`; `map_cache` no longer needs `dev_console`)
- [x] P3.15 `hooks` (the page runtime is TypeScript, bundled to `dist/hooks/runtime.cjs` and served wrapped, so it adds no global but `PB2Hooks`)
- [x] P3.16 `triggers`, gated: `src/features/triggers/console.ts` registers the old
  commands, frame hook and list sections. The code stays JavaScript in
  `desktop/dev/console/{commands,triggers,logic}`, and its tests stay in
  `test/console.test.mjs`. Both move and become TypeScript in P6.1.
- [x] P3.17 `map_editor`, gated: `src/features/map_editor/console.ts` registers the old command, frame hook and list section; the editor key follows the flag. The code stays JavaScript in `desktop/dev/console/editor/` until P6.1.
- [x] P3.18 `login` + `cert_pinning`: `src/features/login/` (credentials file and cookie adapters; flag off starts logged out) and `src/features/cert_pinning/` (the verify procedure). `desktop/login.js` and `test/login.test.mjs` are gone.
- [x] P3.19 `remote_play`: `src/features/remote_play/` (input, lockdown, testers file versioned, WebSocket host, the client in TypeScript built to `dist/remote-client/`, the redactor); `npm run host` quits when the flag is off. The Electron window code stays in `desktop/main.js` until P4.3. `desktop/remote/` and `tools/remote-testers.js` are gone.
- [x] P3.20 `p2p_host`: `src/features/p2p_host/` (config checks, config file, page log lines, console side registering `server`/`who`/`kick`/`say` and starting the host); `npm run p2p-host` quits when the flag is off. The page's host driver stays JavaScript in `desktop/dev/console/server/` until P6.1, the Electron window in `desktop/main.js` until P4.3. `desktop/p2p-host/` is gone.
- [x] P3.21 `client_sadburst`: one client map (`src/shared/clients/keys.ts`, `src/kernel/config/clients.ts`) replaces `desktop/clients.js` and the `SADBURST ? … : …` choices of host, page prefix, settings file, session and run flag; `npm run sadburst` quits when the flag is off.

## P4. Console kernel and wrapper platform
- [ ] P4.1 Console kernel to `src/console/kernel/`. Done so far: `core/` (args, colors as `keys.ts`, error budget, limits as `constants.ts`, words, page mode `mode.ts`), `state/` (settings schema and table, key names, hotkeys, store; the bypass state is `danger/bypass.ts`), `game/` (the game adapter: names, globals through indirect eval, fields as `GAME_FIELDS`, names as `NAMES`, bindings, level, teleport, layers, walls, actions; `NAME_KEYS` is tested against find-names' rules), `ui/` except the panel and completion (dom, theme, labels, log, pager, overlay). Left: `ui/{panel,complete}.js`, `overrides/`, `commands/{registry,help,settings,console,index}.js`, `dispatch.js`, `index.js`.
  Method: port a module to TypeScript, then rewrite every import of the old file to the new one and delete it. The script is `docs/refactor/retarget-imports.py` (`python3 docs/refactor/retarget-imports.py <old.js> <new.ts> ...`); it walks `desktop/`, `src/`, `test/`, `tools/`, `server/`, resolves each relative import, and writes `#console/...` aliases from feature files. Tests that load console modules by path (`consoleModule('state/store.js')`) are fixed by hand.
  `dev-overrides.json` stays unversioned: it is edited by hand and its loader reports any unknown top-level key.
- [ ] P4.2 Rest of `test/console.test.mjs` split; `test/support/fake-game.ts`
- [ ] P4.3 Rest of `desktop/main.js` to `src/wrapper/platform/`; `desktop/main.js` deleted

## P5. Server and tools
- [ ] P5.1 `server/src/`
- [ ] P5.2 `tools/*.ts`

## P6. Finish
- [ ] P6.1 `allowJs` off; lint everywhere at zero warnings; the gated JavaScript (triggers, map editor, console kernel) converted into its feature folders; the `src/**/*.test.mjs` integration tests converted to TypeScript
- [ ] P6.2 Every feature doc, operations doc and `docs/README.md` complete; research docs point at new paths
- [ ] P6.3 (optional) local data in `data/`
- [ ] P6.4 (optional) CI workflow
