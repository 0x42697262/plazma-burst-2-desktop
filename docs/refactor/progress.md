# Refactor progress

The plan is [plan.md](plan.md). Take the first unchecked step and follow its
**test first** and **done when** lines. Run `npm run verify` (`npm test` before P1),
tick the step here, and note anything the next session must know under the step.

## P0. Docs scaffold
- [x] P0.1 `docs/` layout, principles, layers, feature flags, ADRs 0001–0004, plan, this file
- [x] P0.2 Research and guide docs moved into `docs/`; every reference in code, tests and docs updated; remote play also hides `docs/` paths
- [x] P0.3 `AGENTS.md`

## P1. Toolchain
- [ ] P1.1 Dev deps pinned (typescript, esbuild, eslint, typescript-eslint, @types/node), zod
- [ ] P1.2 `tsconfig.json`
- [ ] P1.3 `tools/build.ts` (wrapper, console, server; `--watch`)
- [ ] P1.4 App runs from `dist/`; console served from `dist/console/`; `src/kernel/config/paths.ts`
- [ ] P1.5 ESLint config + local rules `no-comments`, `no-literal-strings` (with tests)
- [ ] P1.6 Scripts `build`, `check`, `lint`, `test`, `verify`
- [ ] P1.7 `.gitignore`: `/dist/`, `/features.json`
- [ ] P1 tests: the bundle boots in the fake game; no new globals besides `pb2dev`

## P2. Kernel
- [ ] P2.1 `src/shared/contract/routes.ts` replaces `desktop/dev/console/shared.json`
- [ ] P2.2 `src/kernel/config/{env,settings}.ts`; every `process.env`/`process.argv` read moved there
- [ ] P2.3 Feature catalog, `resolve()`, `features.json` adapter
- [ ] P2.4 `src/kernel/persist/{versioned,serial}.ts`
- [ ] P2.5 `src/kernel/log/` structured logger and events catalog
- [ ] P2.6 Composition roots (wrapper, router, console) with fallback to the old code; `allowedHere` from the catalog
- [ ] P2.7 `features` console command and `--features` start flag

## P3. Feature migrations
- [ ] P3.1 `netlog` + security fix 1 (AUTHENTICATE password redacted; `tools/redact-netlogs.ts`, run only after asking the user)
- [ ] P3.2 `server_list` + security fix 2 (password dropped when address or pin changes; `servers.json` versioned)
- [ ] P3.3 `fingerprint` + `lobby_tasks_private` + `net/tap` + security fix 3 (no RELIABLE_TASK from private lobbies)
- [ ] P3.4 `screenshot`
- [ ] P3.5 `js_eval`
- [ ] P3.6 `zoom`
- [ ] P3.7 `game_chat`
- [ ] P3.8 `trace`
- [ ] P3.9 `profiles`
- [ ] P3.10 `binds`
- [ ] P3.11 `guns`
- [ ] P3.12 `player`
- [ ] P3.13 `scan_bypass`
- [ ] P3.14 `map_cache`
- [ ] P3.15 `hooks`
- [ ] P3.16 `triggers`
- [ ] P3.17a `map_editor` domain (doc, history, edit)
- [ ] P3.17b `map_editor` UI (view, panels, dropdown)
- [ ] P3.17c `map_editor` services (session, loader, apply)
- [ ] P3.18 `login` + `cert_pinning`
- [ ] P3.19 `remote_play`
- [ ] P3.20 `p2p_host`
- [ ] P3.21 `client_sadburst`

## P4. Console kernel and wrapper platform
- [ ] P4.1 Console kernel to `src/console/kernel/`
- [ ] P4.2 Rest of `test/console.test.mjs` split; `test/support/fake-game.ts`
- [ ] P4.3 Rest of `desktop/main.js` to `src/wrapper/platform/`; `desktop/main.js` deleted

## P5. Server and tools
- [ ] P5.1 `server/src/`
- [ ] P5.2 `tools/*.ts`

## P6. Finish
- [ ] P6.1 `allowJs` off; lint everywhere at zero warnings
- [ ] P6.2 Every feature doc, operations doc and `docs/README.md` complete; research docs point at new paths
- [ ] P6.3 (optional) local data in `data/`
- [ ] P6.4 (optional) CI workflow
