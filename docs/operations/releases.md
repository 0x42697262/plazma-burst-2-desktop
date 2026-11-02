# Releasing an app

A release is one [edition](editions.md) packaged for players: Linux (AppImage) and
Windows (installer and portable `.exe`). macOS is not built.

## Step by step

From an edition file to a file you hand out:

1. Pick or write the edition: `editions/<name>.json` ([editions](editions.md#edition-files)).
   `npm start -- --features` lists the feature ids.
2. Check that it builds: `npm run build -- --edition <name>`. It prints the features,
   or what is missing and must be added to the file.
3. Run `npm run verify`. The edition tests build every file in `editions/`.
4. Commit the edition file with the code it builds.
5. Package it: `npm run release -- --edition <name> --linux`. The AppImage is in
   `release/<name>/`, named after the edition's title, for example
   `release/example/Plazma-Burst-2-Example-1.0.0-linux-x86_64.AppImage`.
6. Try it as a player would: start that file. The first start downloads the game into
   `~/.config/<title>/game` and opens the server list (with `server_list`).
7. For Windows, see [Windows](#windows); to publish both, see
   [With GitHub Actions](#with-github-actions).

The version in the file names is `version` in `package.json`: raise it before a
release you publish.

## Locally

```
npm run release -- --edition <name>             # for the system it runs on
npm run release -- --edition <name> --linux --windows
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

## Windows

```
npm run release -- --edition <name> --windows
```

This writes the installer and the portable `.exe` to `release/<name>/`. On Windows it
needs nothing more. On Linux, electron-builder needs Wine (Arch: `sudo pacman -S wine`);
without Wine, let the release workflow build them on Windows
([With GitHub Actions](#with-github-actions)).

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

`.github/workflows/release.yml` runs on a pushed `v*` tag, or by hand (Actions tab,
"release", Run workflow):
- it lists the editions in `editions/` (all but `dev`), and packages each one on Linux
  and on Windows (`npm run verify` runs first on Linux);
- on a tag, it creates a draft GitHub release with every package attached. Check it and
  publish it on GitHub. Run by hand, it makes no release: the packages are the run's
  artifacts, on its page.

Publishing version 1.0.1, for example:

```
npm version 1.0.1 --no-git-tag-version   # sets version in package.json
git commit -am "release: 1.0.1"
git tag v1.0.1
git push && git push origin v1.0.1
```

Then open the draft release on GitHub, check its files, and publish it.

The version in the file names is the `version` in `package.json`.
