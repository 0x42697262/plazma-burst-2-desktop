# Releasing an app

A release is one [edition](editions.md) packaged for players: Linux (AppImage) and
Windows (installer and portable `.exe`). macOS is not built.

## Locally

```
npm run release -- --edition player             # for the system it runs on
npm run release -- --edition player --linux --windows
```

`src/tools/release/cli.ts`:
1. reads `editions/<name>.json` and stops on a problem (an edition with every feature
   only gets a warning: it is meant for development);
2. empties `dist/` and builds the edition: the page scripts, the main process
   (`dist/wrapper/main.cjs`) and what its features need;
3. stages `release/<name>/app/`: `dist/` without source maps, and a `package.json` with
   the edition's id, title and `desktopName`, and `main` pointing at the bundled main
   process. No `node_modules`: everything the app runs is in the bundles, Electron aside;
4. packages that with electron-builder (`src/tools/release/config.ts`) into
   `release/<name>/`, for example `Plazma-Burst-2-Client-1.0.0-linux-x86_64.AppImage`.

Building the Windows targets on Linux needs Wine; the release workflow builds them on
Windows instead.

## What a player gets

- The app has only the edition's features; the rest is not in it
  ([editions](editions.md)).
- At first start it downloads the game into its per-user folder, finds the game's names,
  and opens (with `server_list`) the server list; at later starts it checks for a new
  game version ([game setup](../features/game-setup.md)).
- Its files (`data/`, `game/`) are in Electron's per-user folder for the app's title, for
  example `~/.config/Plazma Burst 2 Client/` on Linux and
  `%APPDATA%\Plazma Burst 2 Client\` on Windows.
- The app is not signed. Windows SmartScreen warns about an unknown publisher until it
  is (a code-signing certificate is a later step).

## With GitHub Actions

`.github/workflows/release.yml` runs on a pushed `v*` tag (or by hand):
- it lists the editions in `editions/` (all but `dev`), and packages each one on Linux
  and on Windows (`npm run verify` runs first on Linux);
- on a tag, it creates a draft GitHub release with every package attached. Check it and
  publish it on GitHub.

The version in the file names is the `version` in `package.json`.
