# game_setup: getting the game

Feature flag `game_setup` (on by default; all modes). Code: `src/features/game_setup/`.

- Before the app opens its window, it makes sure the game is there
  (`src/wrapper/start.ts`, then `services/ensure-game.ts`):
  - **No game yet:** the latest version is downloaded (Sad Burst 2: the current build),
    then its names are found ([find-names](../operations/find-names.md)). A small window
    shows the progress.
  - **An installed app** (`app.isPackaged`) also asks the site for the latest version at
    every start, and downloads it when it is newer. Run from the repository, the game in
    `game/` is never replaced: `npm run fetch-game` does that when you want it.
  - **Names that do not match the game's version** are found again.
  - **Offline:** with a game here, the app plays it and logs why it could not check;
    without one, it says so in a dialog and stops.
- The downloads are the same code as `npm run fetch-game` and `npm run find-names`
  (`src/tools/fetch-game/`, `src/tools/find-names/`), called with a `say` callback
  instead of printing (`adapters/downloads.ts`). The old copy is kept as
  `game.previous/`.
- Names it cannot find are an error: joining private servers is refused until they are
  found (the lobby task guard needs them).
- The download's own warnings (for example `index.html references missing l.origin`,
  JavaScript in the page that its link scanner reads as a file) are logged as warnings
  when the game is ready anyway.
- It does not run with `PB2_GAME_DIR` (a game copy you chose), or for Sad Burst 2 when
  `client_sadburst` is off.
- The map editor's action names (`opcodes.js`) are not fetched here; the dev console
  works without them, and `npm run fetch-game` gets them.
