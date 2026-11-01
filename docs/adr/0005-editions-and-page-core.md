# 0005. Released apps as editions, and a page core apart from the dev console

Date: 2026-11-02. Status: accepted.

## Context
The app is to be released compiled, for Linux and Windows (macOS is not a goal), as
several apps with different features: for example one with only the official client,
Sad Burst 2 and private servers, without the dev console or the map editor.

- A feature flag only stops a feature from registering. Its code still ships, and
  `features.json` or `PB2_FEATURES` turns it back on.
- The lobby task guard and the private-server join client ran inside the dev console
  bundle and required `dev_console`. With the console off, a private server's lobby could
  run code in the page again ([fingerprinting research](../research/fingerprinting.md)
  §9), and joining a private server did not work.
- The wrapper runs `src/wrapper/main.ts` directly and keeps local data in the repository's
  `data/`; an installed app can do neither.

## Decision
- **Page core.** What the game page needs to play safely is its own entry,
  `src/page/index.ts`: the lobby task guard and the private-server join client, on top of
  the game adapter. The wrapper injects it whenever one of its features or the dev
  console is on. The dev console (`src/console/index.ts`) is a second entry, injected only
  when `dev_console` is on. Both are built in one esbuild run with code splitting, so the
  modules they share (game adapter, network tap) exist once in the page. The page core
  reports through `src/page/report.ts`: to the page's console (and so the terminal), or to
  the dev console's panel once the console is loaded.
- **Editions.** An edition is a data file (`editions/<name>.json`) listing its features;
  a release build takes one edition, or a one-off feature list. The build resolves the
  list with the same catalog and resolver as the app: features a listed feature requires
  are added, impossible lists stop the build, and the security features
  (`lobby_task_guard`, `cert_pinning`) are always in when `server_list` is. The build
  generates each side's feature list from the edition, so left-out code is not bundled,
  and the catalog marks left-out features absent: no file or variable can turn them on.
  The edition's name and feature list are compiled in, and its app id keeps installed
  editions apart.
- **Release packaging.** The main process is bundled (`dist/wrapper/main.cjs`); local data
  goes to Electron's per-user folder when packaged; the game is downloaded at first run
  (fetch-game and find-names in the app), never shipped; electron-builder makes an
  AppImage and an NSIS installer per edition, from a CI matrix.

## Rejected
- **Ship everything and turn features off with flags.** Pros: no build changes. Cons:
  left-out code still ships and can be turned on again.
- **A fixed list of editions in code.** Pros: simple. Cons: every new app is a code
  change.
- **Two separate bundles without code splitting.** Pros: simpler build. Cons: the game
  adapter and the network tap would load twice, and two taps on one game method run in
  an order nobody chose.
- **Keep the guard in the console and force the console on.** Pros: no split. Cons: the
  console ships in every app, which is what an edition is meant to avoid.

## Consequences
- A test boots the page core alone and checks a private server's tasks are still not run.
- Each edition is tested as built: its bundles hold only its features, and it boots.
- Order of work: page core, editions, bundled main process and per-user data, first-run
  game download, packaging and the release workflow.
