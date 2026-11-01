# Refactor plan: feature modules, TypeScript, flags, docs

## Context

The repo is about 25k lines of plain JS: an Electron wrapper (`desktop/main.js` at 1,161 lines, plus `desktop/*.js`), an in-page dev console (`desktop/dev/console/`, 107 files, 27 command modules), a private game server (`server/`), fetch and codegen tools (`tools/`), and `node:test` tests (`test/`, `console.test.mjs` alone is 2,985 lines). The user wants it refactored to their architecture guideline (pasted in the session; saved in P0 as `docs/architecture/principles.md`) plus these extra rules:

- Every feature is behind a feature flag: console commands, hooks, Sad Burst, remote play, everything.
- No single-letter variable names (see the assumption under Conventions).
- No comments. The *why* goes in `docs/`.
- Separation of concerns: entry → service → pure domain → adapters.
- One source of truth.
- No magic strings or values.
- Explaining variables replace comments.
- Tests first (TDD) wherever it applies.
- One `docs/` directory for everything.
- Modular: one folder per feature.

The plan is written so that **any later session can pick up the next unchecked step** from `docs/refactor/progress.md`, which P0 creates.

### Decisions already made by the user
| Topic | Chosen | Rejected (why) |
|---|---|---|
| Types | **Full TypeScript with a build step** | JSDoc + checkJs (wordier, weaker); none (breaks guideline §9) |
| Flags | **Layered**: a catalog in code, then env, then a local `features.json`; a read-only `features` console command | env only (clumsy for many commands); runtime toggle in the console (pushed RELIABLE_TASK code can write kv and would turn dangerous features back on) |
| Modularity | **Feature modules**: one folder per feature, holding a manifest, domain, adapters and entry | layered folders with flags (a feature stays spread out and can't be removed cleanly) |
| Security fixes | **Inside the refactor**, in the phase of the feature they belong to. Those features are migrated first (P3.1–P3.3) so the fixes land early | a separate fix before the refactor |

### Behavioural rule for the whole refactor
It is a refactor: **behaviour stays the same unless a step says otherwise.** Flag defaults reproduce today's behaviour. Only the three security fixes change behaviour, and each has its own test and docs entry.

---

## Recommendations still open (options, pros and cons; defaults chosen, change on review)

1. **Config and payload validation library.** **Recommended: zod** (exact pinned version).
   - zod. Pros: types are inferred from the schemas, it works in Node and in the browser bundle, and it is the de facto standard. Cons: one dependency, about 50 KB in the console bundle.
   - valibot. Pros: tiny and tree-shakable. Cons: less familiar.
   - Hand-rolled. Pros: no dependency. Cons: every schema written twice, as a type and as checks, and the two drift.
2. **Where tests live.** **Recommended: colocated** `features/<id>/**/*.test.ts`, with cross-feature and integration tests kept in `test/`.
   - Pros: a feature folder is self-contained, and deleting the feature deletes its tests.
   - Cons: the test glob gets more complex.
3. **Enforcing "no comments".** **Recommended: a local ESLint rule** in `tools/eslint-rules/no-comments.ts`, which allows only `eslint-disable … -- reason`, `@ts-expect-error reason`, `/// <reference>` and license headers.
   - Alternative: review only. Pros: no tooling. Cons: comments slip in.
4. **Enforcing "no magic values".**
   - Numbers: ESLint `no-magic-numbers` (ignore 0, 1, −1, array indexes) with `constants.ts`, `*.test.ts` and `text.ts` exempt.
   - Strings: a **local ESLint rule** `no-literal-strings` that flags string literals outside `constants.ts`, `text.ts`, `events.ts`, `keys.ts`, tests and import specifiers. **Recommended: on as an error per migrated folder**, because it is noisy on unmigrated JS.
   - Alternative: review only.
5. **Workspaces.** **Recommended: a single package now** with path aliases (`@shared/*`, `@kernel/*`, `@features/*`). Move to npm workspaces (`packages/shared`, `apps/wrapper`, `apps/console`, `apps/server`) only if `server/` is ever shipped separately.
   - Pros: one `package.json` and one install.
   - Cons: nothing stops a wrapper module importing a console module, except a lint rule (`no-restricted-imports` per folder), which is added in P1.
6. **Where local data lives.** Today it is scattered over `desktop/*.json`, `netlogs/`, `fingerprint/` and `screenshots/`. **Recommended: one `paths` config module first (P2) with today's paths**, then optionally move everything to `data/` with a one-time move migration (P6, optional).
   - Pros: the move is one later step, not mixed into the refactor.
   - Cons: two steps instead of one.
7. **Disabled features: are they loaded at all?** **Recommended: bundled but not activated**: no commands, routes or ticks registered. Lazy chunks through esbuild code splitting are possible later.
   - Pros: simple.
   - Cons: disabled code still ships in the bundle.

---

## Conventions (apply to every migrated file)

- **Naming.** No single-letter identifiers, enforced by ESLint `id-length: {min: 2, exceptions: ['_']}`. **Assumption:** "no single variables" means no one-letter names like `v`, `c`, `e`, `n`, `i`. If it meant "no module-level mutable singletons" (e.g. `let tapped = null` in `net/fingerprint.js`), that rule is added too: such state moves into a service object made by the composition root.
- **Explaining variables.** Compound conditions get a name:
  ```ts
  const isFingerprinterTask = kind !== undefined && source.includes(FINGERPRINTER_MARKER);
  ```
  Regexes get named constants, and branches get small named functions.
- **No comments.** Before deleting a comment, **move its why into the feature's doc** (`docs/features/<id>.md`). Existing comments hold real knowledge (game internals, anti-tamper limits, npm quirks), so this step is mandatory and checked in review.
- **One place per kind of value.** Each feature folder has:
  - `constants.ts`: fixed internal values: limits, intervals, sizes.
  - `text.ts`: every user-facing string: console prints, help, errors.
  - `events.ts`: log event names and their message builders.
  - `keys.ts`: route names, storage keys, file names.
  - Enums are `as const` objects plus union types (`erasableSyntaxOnly`, so no TS `enum`).
- **Layers inside a feature.**
  - `domain/`: pure. No I/O, clock, env or game access; `now`, ids and settings are passed in.
  - `services/`: orchestrate one use case.
  - `adapters/`: files, fetch, the game adapter, the Electron API.
  - `entry/`: console commands, HTTP routes, ticks. They stay thin: validate, call a service, shape the output.
- **Boundaries validate.** Every HTTP route body and query, every file read, every game packet field and every env var is parsed with a schema at the edge.
- **Persisted JSON is versioned.** It is `{ schemaVersion: N, ... }`, read through `kernel/persist/versioned.ts`, which runs migrations `vN → vN+1` on read and writes back the latest. A file with no version counts as v0.
- **Tests first.**
  - For a move: first a *characterization* test that pins today's behaviour; then move the code; the test stays green.
  - For a fix: a failing test first.
- **One commit per step** (no Co-Authored-By trailers), made only when the user asks.

---

## Target layout (strangler: new `src/` grows, old files are deleted as they move)

```
src/
  shared/                      wrapper ↔ console contract, imported by both sides
    contract/routes.ts         replaces desktop/dev/console/shared.json
    contract/schemas.ts        zod schemas for every __dev route request/response
    features/catalog.ts        THE feature catalog: id, flag default, owner, sides, availableIn, description
    features/types.ts          FeatureId, FlagState, Availability ('local'|'remote'|'server')
  kernel/                      cross-cutting, no feature logic
    config/env.ts              the only reader of process.env/argv; zod schema; fail fast
    config/settings.ts         typed frozen Settings (derived values resolved once)
    config/paths.ts            every file/dir path (today's locations)
    flags/resolve.ts           pure: resolve(catalog, envOverrides, fileOverrides) → FlagState
    flags/features-file.ts     adapter: features.json (versioned, gitignored)
    persist/versioned.ts       versioned JSON read/migrate/atomic-write (from fingerprint.js writeIndex pattern)
    persist/serial.ts          the serial queue (from desktop/fingerprint.js createFingerprints)
    log/logger.ts              structured JSON logger (from desktop/log.js)
    log/events.ts              kernel log events
  wrapper/                     Electron main process
    main.ts                    composition root: settings → flags → features → window
    http/router.ts             route table built from enabled features' routes
    platform/                  window, protocol interception, sessions, game file serving
    features.ts                explicit list of wrapper sides of features (the one wiring place)
  console/                     in-page dev console
    index.ts                   composition root
    kernel/                    registry, dispatch, ui/, state/store, game/ (adapter: names, bindings, tap)
    features.ts                explicit list of console sides of features
  features/<id>/
    console.ts                 export const consoleSide: ConsoleFeature = { id, commands, ticks, onStart }
    wrapper.ts                 export const wrapperSide: WrapperFeature = { id, routes, onReady }
    domain/ services/ adapters/ entry/
    constants.ts text.ts events.ts keys.ts
    *.test.ts
server/src/…                   same shape, P5
tools/*.ts                     run with Node type stripping, P5
docs/                          see Docs layout
dist/                          build output (gitignored)
```

**Feature interfaces** live in `src/shared/features/types.ts`:
```ts
interface ConsoleFeature { id: FeatureId; commands?: CommandDef[]; ticks?: Tick[]; frame?: FrameHook[]; onStart?(deps: ConsoleDeps): void }
interface WrapperFeature { id: FeatureId; routes?: RouteDef[]; onReady?(deps: WrapperDeps): Promise<void> }
interface Tick { name: string; everyMs: number; errorBudget: number; run(): void }
```
- **Each composition root** imports its `features.ts` list and keeps only those with `flags.isOn(id)` and `availableIn` matching the mode (local, remote or server). This replaces today's `allowedHere()` in `desktop/dev/console/core/remote.js`, so `remote: false` and `server: true` become catalog data.
- **What the roots register.** The console registers commands, ticks and frame hooks; it replaces the hard-coded `onFrame` and `setInterval` list in `desktop/dev/console/index.js`. The wrapper builds the route table; it replaces the `if` chain in `serveDev()` in `desktop/main.js:445-532`.
- **A feature that is off:** its commands are not listed (the `help` output says nothing), its routes return 404, and its ticks never run.
- **Dependencies between features** are declared in the catalog (`requires: ['map_cache']`). The resolver turns a feature off when one it requires is off, and logs why (one place for derived flags, guideline §3.3).
- **Cross-feature calls** go through a service exported from the feature's `index.ts`. Reaching into another feature's internals is blocked by a lint rule.

**Build.**
- esbuild (exact pinned version) makes three outputs:
  - `dist/wrapper/main.cjs`: node platform, `electron` external.
  - `dist/console/index.js`: browser, ESM. It **must add no globals** (ANTICHEAT §6: the game's anti-tamper scan compares globals and classes); only `globalThis.pb2dev` stays, as today.
  - `dist/server/index.cjs`.
- `package.json` `main` changes to `dist/wrapper/main.cjs`, and `start`/`sadburst`/`host`/`p2p-host` become `npm run build && electron . …`.
- `serveConsoleFile` serves `dist/console/` instead of `desktop/dev/console/`.
- Tests and tools run the `.ts` sources directly with Node's type stripping (Node 26 locally). Set `engines.node` to `>=22.18`. `tsconfig`: `erasableSyntaxOnly`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, plus `allowJs` while the migration runs (removed in P6).

---

## Feature catalog (initial ids; the defaults keep today's behaviour)

| id | default | availableIn | today's files | notes |
|---|---|---|---|---|
| `dev_console` | on (env `PB2_DEV=0` keeps working as an alias) | all | `desktop/dev/console/index.js`, `main.js` DEV_* | parent of every console feature |
| `console_core` | on, cannot be turned off | all | registry, dispatch, help, settings list/set/get/unset/reset, `more`/chain, `ui/`, `state/` | kernel, listed for completeness |
| `profiles` | on | all | `commands/profile.js` | |
| `player` | on | all | `commands/player.js`, `overrides/{god,force,frame}.js`, `game/teleport.js`, tp/pos/chars | |
| `guns` | on | all | `commands/guns.js`, `game/guns.js` | |
| `binds` | on | all | `commands/binds.js`, `keyname.js`, `state/hotkeys.js` | |
| `triggers` | on | all | `commands/{triggers,regions,vars,logic}.js`, `triggers/`, `logic/` | |
| `trace` | on | all | `commands/trace.js`, `ui/trace.js`, `main.js` TRACE tags | |
| `map_editor` | on | local, server | `commands/editor.js`, `editor/` (23 files) | largest; requires `map_cache` |
| `map_cache` | on | all | `commands/maps.js`, `maps/cache.js`, `main.js` saveMap/saveEditedMap/serveLocalMap/serveServerMap, `map-text.js` | |
| `game_chat` | on | all | `commands/game-chat.js` | |
| `zoom` | on | all | `commands/zoom.js` | |
| `screenshot` | on | all | `commands/screenshot.js`, `main.js` saveScreenshot | rate limit for remote is a constant |
| `netlog` | on (recording itself still follows the `net_log` key) | local, server | `commands/netlog.js`, `net/{recorder,codec,state}.js`, `desktop/netlog.js` | **security fix 1** |
| `fingerprint` | on | local | `commands/fingerprint.js`, `net/fingerprint.js`, `desktop/fingerprint.js` | |
| `lobby_tasks_private` | **off** (new) | local | `net/tap.js` + join | **security fix 3**: drops RELIABLE_TASK* from non-official lobbies |
| `scan_bypass` | on | local | `commands/bypass.js`, `net/scan-report.js`, `overrides/server-checks.js` | |
| `js_eval` | on | local, server | `commands/js.js` | `remote: false` today |
| `hooks` | on (`PB2_HOOKS=0` alias; forced off for sadburst through the catalog's `conflicts`) | local | `desktop/hooks.js`, `hooks-runtime.js`, `commands/hooks.js`, `main.js` serveHooks | |
| `server_list` | on | local | `desktop/servers.js`, `launcher/`, `commands/servers.js`, `join/client.js`, `core/join.js`, `main.js` serveServerList* | **security fix 2** |
| `login` | on | local | `desktop/login.js`, `main.js` applyCredentials/startLoggedOut | |
| `cert_pinning` | on | local | `main.js` pinServerCertificates | |
| `remote_play` | on | host mode | `desktop/remote/`, `core/remote.js` redactor, `tools/remote-testers.js` | |
| `p2p_host` | on | server mode | `desktop/p2p-host/`, `commands/server.js`, `server/host.js`, `core/server.js` | |
| `client_sadburst` | on | n/a | `desktop/clients.js`, `tools/fetch-sadburst.js`, `find-names-sadburst.js` | the client choice becomes a strategy map `CLIENTS`; the flag only allows `--sadburst` |

**Override order** (resolved once at boot, logged as one line `flags.resolved` with every non-default flag and its source):
1. catalog default;
2. `features.json` (gitignored, versioned);
3. env `PB2_FEATURES=+id,-id`, plus the legacy aliases `PB2_DEV` and `PB2_HOOKS`;
4. hard constraints (`requires`, `conflicts`, `availableIn`).

The console receives the resolved flags in the page's boot script, set non-enumerable like `PB2_REMOTE` today. **It cannot change them.**

---

## Docs layout (P0 creates it; later phases fill it)

```
docs/README.md                         one line per topic
docs/architecture/principles.md        the pasted guideline + the extra rules above
docs/architecture/layers.md            layers, the feature interfaces, composition roots, build
docs/architecture/feature-flags.md     catalog, override order, aliases, how to add a flag
docs/adr/0001-typescript-esbuild.md
docs/adr/0002-feature-flags-layered.md
docs/adr/0003-feature-modules.md
docs/adr/0004-versioned-local-files.md
docs/features/<id>.md                  one per catalog id: flow, numbers, edge cases, log events, why (from deleted comments)
docs/research/anticheat.md             git mv ANTICHEAT.md
docs/research/fingerprinting.md        git mv FINGERPRINTING.md
docs/operations/running.md             start modes, env vars, flags (from README.md)
docs/operations/private-server.md      from server/README.md
docs/operations/remote-play.md         from desktop/remote/README.md
docs/operations/p2p-host.md            from desktop/p2p-host/README.md
docs/features/hooks.md + hooks-reference.md   from hooks/README.md, hooks/REFERENCE.md (.gitignore exceptions updated)
docs/refactor/plan.md                  this plan
docs/refactor/progress.md              checklist mirroring the steps below; every session ticks what it finished
AGENTS.md                              conventions, confirmed facts (game internals with file:line), verification checklist
README.md                              stays: what it is, setup, run, test
```
Note: earlier in this repo's history the user said not to read markdown files. The doc moves in P0 are `git mv` only. Rewriting the docs' content (P6) needs reading them, which this refactor's request ("a specific docs directory for everything") covers.

---

## Phases and steps

Each step lists: **do**, **test first**, **done when**. After every step run `npm run verify` (from P1 on), tick it in `docs/refactor/progress.md`, and commit if the user asked for commits.

### P0. Docs scaffold (no code changes)
1. Create `docs/` per the layout. Write `principles.md` (the guideline + extra rules), the four ADRs (context/decision/consequences, with the rejected options from the tables above), `plan.md` (a copy of this file) and `progress.md` (a checklist of every step id below).
2. `git mv` ANTICHEAT.md, FINGERPRINTING.md, server/README.md, desktop/remote/README.md, desktop/p2p-host/README.md and hooks/*.md into `docs/`. Fix the paths that point at them: in code, `grep -rn "ANTICHEAT.md\|FINGERPRINTING.md\|README.md\|REFERENCE.md"`; in `.gitignore`, the `!/hooks/README.md` lines.
3. `AGENTS.md`: conventions, plus how to resume (read `docs/refactor/progress.md`, take the first unchecked step).
- **Done when:** `npm test` is still green (142) and no link in the code points to a moved file.

### P1. Toolchain (no behaviour change)
1. Add dev deps with exact versions (`npm i -DE`): `typescript`, `esbuild`, `eslint`, `typescript-eslint`, `@types/node`. Add `zod` as a runtime dep.
2. `tsconfig.json` with the settings in the Build section, `allowJs: true`, `checkJs: false`, and path aliases.
3. `tools/build.ts` (esbuild, the 3 outputs plus a `--watch` mode). The entries are still today's JS files (`desktop/main.js`, `desktop/dev/console/index.js`, `server/index.js`), so the bundle must reproduce today's app exactly.
4. Switch `main` and the start scripts to `dist/`, and serve the console from `dist/console/`. Files `main.js` reads relative to `__dirname` (`launcher/`, `dev/names.js`, the `desktop/*.json` files) must keep resolving: introduce `kernel/config/paths.ts` here, rooted at the repo, not at `__dirname`.
5. `eslint.config.mjs` with the rules from Conventions. Local rules live in `tools/eslint-rules/` (`no-comments`, `no-literal-strings`), each with its own test. Lint runs **only on `src/**`** at first; legacy files are ignored until they move.
6. Scripts:
   - `build`
   - `check` (`tsc --noEmit`)
   - `lint` (`eslint --max-warnings 0`)
   - `test` (`node --test` over `test/` and `src/**/*.test.ts`)
   - `verify` (all four)
7. `.gitignore`: `/dist/`, `/features.json`.
- **Test first:** a test that builds the console bundle and boots it in `test/fake-game.mjs` (point `CONSOLE_ENTRY` at it), and a test that the bundle adds no enumerable globals besides `pb2dev`.
- **Done when:** `npm run verify` passes, `npm start` and `npm run sadburst` work by hand (the console opens, `help` lists the same commands), and 142+ tests pass.

### P2. Kernel
1. `src/shared/contract/routes.ts` replaces `desktop/dev/console/shared.json`. Both the old `core/shared.js` and `main.js` import it through the build, so there is one source of truth.
2. `src/kernel/config/env.ts` + `settings.ts`: one zod schema for `PB2_GAME_DIR`, `PB2_VERSION`, `PB2_DEV`, `PB2_HOOKS`, `PB2_FEATURES`, the log level (`desktop/log.js parseLogLevel`), the argv modes (`--host`, `--p2p-host`, `--sadburst`, `--verbose`) and `npm_config_sadburst`. Replace every `process.env` and `process.argv` read in `desktop/main.js` (lines 31, 41, 64, 75, 81, 135, 710, 1022, 1084), `desktop/clients.js`, `desktop/log.js` and `desktop/login.js`. **Fail fast**: an invalid value prints the problem and exits before a window opens. Test first: the schema accepts every value accepted today and rejects garbage.
3. `src/shared/features/{types,catalog}.ts` + `src/kernel/flags/resolve.ts` (pure) + `features-file.ts`. Test first: the override order, aliases, `requires`, `conflicts` and `availableIn` resolution, and the resolved-flags log line.
4. `src/kernel/persist/{versioned,serial}.ts`, extracted from `desktop/fingerprint.js` (`serial`, `readIndex`/`writeIndex` atomic tmp+rename). Test first: v0 → v1 migration on read, atomic write, unknown future version refused with a clear error.
5. `src/kernel/log/`: the structured logger (port `desktop/log.js`) with an `events.ts` catalog. Each log call takes `(event, fields)`.
6. Composition roots:
   - `src/wrapper/main.ts` takes over boot from `desktop/main.js`, which still holds the unmigrated functions and is imported by it.
   - `src/wrapper/http/router.ts` dispatches `__dev/<route>` to the enabled features' `RouteDef`s first, then falls back to the old `serveDev`.
   - `src/console/index.ts` likewise registers the enabled `ConsoleFeature`s, then runs the old `index.js` boot for everything not yet migrated.
   - `allowedHere` reads availability from the catalog.
7. `features` console command (read-only): lists every flag, on/off and its source. Add a `--features` flag to the start scripts that prints the same list.
- **Done when:** flags resolve and print, and turning off a not-yet-migrated feature is impossible: the catalog marks it `migrated: false`, so such flags can't be set to non-default values yet and the resolver refuses with a message.

### P3. Feature migrations
Steps are listed in order. The recipe below applies to **each** feature.

**Recipe (per feature `<id>`):**
1. Read every file listed for `<id>` in the catalog table, and its tests.
2. **Characterization tests:** move the feature's existing tests (the relevant blocks of `test/console.test.mjs` and its own test file) into `src/features/<id>/*.test.ts`, unchanged in meaning. Add tests for any behaviour that isn't pinned yet.
3. Create the folder. Port the code to TS while splitting it:
   - pure logic → `domain/`;
   - file, fetch and game access → `adapters/`, using the console kernel's game adapter, never `game/names` directly;
   - use cases → `services/`;
   - commands, routes and ticks → `entry/`.
   - Literals go to `constants/text/events/keys`, and single-letter names get descriptive ones.
4. Move every comment's *why* into `docs/features/<id>.md`, then delete the comments.
5. Version any file the feature persists (schema plus a v0→v1 migration).
6. Add the `console.ts` / `wrapper.ts` sides to the lists. Delete the old files and their entries in `commands/index.js`, `index.js` ticks and `serveDev`. Set `migrated: true` in the catalog.
7. **Flag-off tests:** with the flag off, the commands are missing from `help` and from completion, the routes return 404, the ticks do not run, and nothing is written to disk.
8. Add verification lines to `AGENTS.md` and tick `progress.md`.

**Order** (the security fixes first, then from smallest to largest risk):
- **P3.1 `netlog`.** Add the redaction from **security fix 1**:
  - **Failing test first:** recording an outgoing AUTHENTICATE must write `AUTHENTICATE("<login>", "‹redacted›")`.
  - Redaction runs in the domain function that describes a message, keyed by the message type name, not by its position. The message-type list is data, so other secret-bearing messages can be added.
  - Then a one-time `tools/redact-netlogs.ts` that rewrites existing `netlogs/` files in place. It reports a count, never the values. **Confirm with the user before running it.**
  - The netlog docs section that names the password in logs is updated.
- **P3.2 `server_list`.** Add **security fix 2**:
  - **Failing test first:** saving a server whose address or certificate pin differs from the stored one must drop the stored password. The `play` op on such a server must ask for the password again.
  - `servers.json` gets a version.
  - The rule lives in `domain/` (`passwordSurvivesEdit(previous, next): boolean`).
- **P3.3 `fingerprint` + `lobby_tasks_private` + the console kernel's `net/tap`.** Add **security fix 3**:
  - **Failing test first:** with the lobby pointed at a non-official address (`join/client.js` setLobbyAddress), a RELIABLE_TASK packet never reaches the game's receive method. With the official lobby it does.
  - Implemented as a tap that can drop messages, shared with the recorder through `tap.ts`. The fingerprint capture still records the dropped source, marked `private-server`.
  - The fingerprint `index.json` gets a version.
- **P3.4** `screenshot`
- **P3.5** `js_eval`
- **P3.6** `zoom`
- **P3.7** `game_chat`
- **P3.8** `trace`
- **P3.9** `profiles`
- **P3.10** `binds`
- **P3.11** `guns`
- **P3.12** `player`
- **P3.13** `scan_bypass`
- **P3.14** `map_cache` (wrapper map routes + `map-text.js`)
- **P3.15** `hooks` (wrapper + console). `hooks.test.mjs` moves.
- **P3.16** `triggers` (with `logic/`)
- **P3.17** `map_editor`: 23 files. Split into sub-steps by folder (`doc/history/edit` domain first, then `view/panels/dropdown` UI, then `session/loader/apply` services).
- **P3.18** `login` + `cert_pinning`
- **P3.19** `remote_play`. The redactor is a domain function, `makeRedactor` in `core/remote.js`.
- **P3.20** `p2p_host`
- **P3.21** `client_sadburst`: `CLIENTS` becomes a strategy map consumed by `paths.ts` and settings. The `SADBURST ? a : b` ternaries in `main.js` (lines 25–26, 65, 67, 75, 97, 162, 181) and in the console (`game/names.js`, `index.js` KV_FILE) become per-client fields: `kvFile`, `mapsDir`, `fingerprintDir`, `partition`, `hooksAllowed`.

### P4. Console kernel and wrapper platform
1. Port `desktop/dev/console/{commands/registry,dispatch,ui,state,core,game}` to `src/console/kernel/`, with the same recipe and no flags (`console_core`).
   - `game/bindings.js` and `names.js` are the vendor adapter for the obfuscated game. Its API is typed with `unknown` at the boundary and validated before use.
   - The module-level mutable state becomes kernel services built in `index.ts`.
2. Split the rest of `test/console.test.mjs` into kernel tests. `fake-game.mjs` becomes `test/support/fake-game.ts`.
3. Whatever is left of `desktop/main.js` (window, protocol interception, `serveLocal`, `fetchAndKeep`, the logging bridge `logPage` and `logServerPage`) moves to `src/wrapper/platform/`. Then `desktop/main.js` is deleted.
- **Done when:** `desktop/dev/console/` and `desktop/*.js` are gone; only `desktop/launcher/` static assets, moved to `src/features/server_list/assets/`, and the local data files remain.

### P5. `server/` and `tools/`
1. `server/` → `server/src/` with the same layering. Its config (`server/config.js`) uses a zod schema, and `server.json` gets a version. Flags come from the same catalog, with entries scoped to `server`.
2. `tools/*.js` → `tools/*.ts`, run with Node type stripping. `find-names` rules become data (their table already is), and the generated `names.js` output format stays unchanged.

### P6. Finish
1. Remove `allowJs`. Turn lint on for every folder, `no-literal-strings` included, at zero warnings.
2. Fill in every `docs/features/<id>.md`, `docs/operations/*` and `docs/README.md`. Rewrite `docs/research/*` paths to the new file locations.
3. Optionally move local data to `data/` with a one-time move migration (recommendation 6).
4. Optionally add a CI workflow (`.github/workflows/verify.yml` running `npm ci && npm run verify`) if the repo is pushed to GitHub.

---

## Verification (end to end)

- **Every step:** `npm run verify` (lint, type check, tests, build) is green, and the test count never drops; moved tests count.
- **Manual smoke after P1, P2, each P3 step and P4**, all from the built app:
  - `npm start`: the console opens with Shift+`; `help` lists the expected commands; `features` shows the flags.
  - `PB2_FEATURES=-<id> npm start`: the feature's commands are gone and its routes return 404 (check from the console's `js` with `fetch('__dev/<route>')`).
  - `npm run sadburst` starts with hooks off.
  - The `npm run p2p-host` and `npm run host` modes start.
- **Security fixes:**
  - **Fix 1:** log in once with net_log on, and the new `netlogs/` line shows `‹redacted›`. Count lines with `grep -c AUTHENTICATE` and print no values.
  - **Fix 2:** edit a saved server's address in the launcher, and `play` asks for the password.
  - **Fix 3:** join a private server built from `server/`; its lobby sends no tasks, so nothing changes. A test server sends a fake RELIABLE_TASK, and the game never evaluates it (check that no side effect such as a global marker appears).
- **No globals:** the P1 bundle test stays green after every console step.
