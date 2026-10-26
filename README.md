# Plazma Burst 2 Desktop

An Electron wrapper for the [Plazma Burst 2](https://www.plazmaburst2.com/h5/) HTML5 game. It
plays a local copy of the game under its real URL (login, multiplayer and maps work like on
the website) and adds a developer console (Shift+`` ` ``, i.e. `~`).

The game files are **not** in this repository. You download them with a script.

## Contents

1. [Quick start](#1-quick-start)
2. [Folder layout](#2-folder-layout)
3. [Getting the game files](#3-getting-the-game-files)
4. [Updating to a new game version](#4-updating-to-a-new-game-version)
5. [Finding the obfuscated names](#5-finding-the-obfuscated-names)
6. [Configuration](#6-configuration)
7. [Troubleshooting](#7-troubleshooting)

## 1. Quick start

Requirements: Node.js 18 or newer, npm.

```bash
npm install          # Electron (its binary downloads on the first start)
npm run fetch-game   # the game files, about 57 MB, about 1 minute
npm start
```

In the game, press Shift+`` ` `` (`~`) for the dev console and type `help`.

## 2. Folder layout

| Path | What | In git |
|---|---|---|
| `desktop/main.js` | Electron app: serves `game/`, injects the dev console | yes |
| `desktop/dev/devconsole.js` | The dev console | yes |
| `desktop/dev/names.js` | Obfuscated game names for the current game version (generated) | no |
| `desktop/maps/` | Local maps (`local-<name>` as the map ID) | yes |
| `desktop/credentials.json` | Your login (copy `credentials.example.json`) | no |
| `desktop/dev-overrides.json` | Dev console settings | no |
| `tools/fetch-game.js` | Downloads the game | yes |
| `tools/find-names.js` | Generates `desktop/dev/names.js` | yes |
| `game/` | The downloaded game | no |
| `game.previous/` | The copy before the last update | no |

## 3. Getting the game files

### Automatic (recommended)

```bash
npm run fetch-game                  # newest version
npm run fetch-game -- v1769098419   # a specific version
```

The script:

1. Reads the current version from `https://www.plazmaburst2.com/h5/` (the "Launch" link points to `versions/v<number>/`).
2. Downloads `index.html` and everything it references (`_strings.js`, `loading_screen.css`, `scripts/...`).
3. Finds every folder mentioned in the code (`scripts/`, `flash_export/`, `fonts/`, `audio_overrides/`, `bitmap_overrides/`, `loading_screen/`) and downloads them completely through the server's directory listings.
4. Checks that every file in the sprite/sound list (`flash_export/just_sounds_and_bitmaps.html`) was downloaded.
5. Writes `game/pb2-version.json` (the app reads the version from it).
6. Moves the old `game/` to `game.previous/`, then puts the new copy in `game/`.
7. Runs `npm run find-names` (section 5).

The download goes into `game.download/` first, so a failed download never breaks your working copy.

> Changes you made inside `game/` are not carried over. They stay in `game.previous/` until the next update.

### Manual

Use this if the script stops working.

1. Open `https://www.plazmaburst2.com/h5/` and find the version in the "Launch" link, e.g. `v1769098419`. Below, `BASE` is `https://www.plazmaburst2.com/h5/versions/v1769098419`.
2. Download these into `game/`, keeping the folder structure:
   - `BASE/index.html`
   - every `src="..."`/`href="..."` in `index.html` that is a relative path (not `/cdn-cgi/...`)
   - every `url(...)` in `loading_screen.css`
3. Download these folders completely. Each one has a directory listing ("Index of ..."); the root folder does not:
   - `scripts/` (with `libs/` and `screens/`)
   - `flash_export/` (with `images/`, `sky/`, `sounds/`)
   - `fonts/`, `audio_overrides/`, `bitmap_overrides/`, `loading_screen/`

   With `wget`, one folder at a time:

   ```bash
   cd game
   wget -r -np -nH --cut-dirs=3 -R "index.html*" "$BASE/flash_export/"
   ```

4. Look for new folders: search the code for strings like `'name/...'` and open `BASE/name/` in a browser.
5. Create `game/pb2-version.json`:

   ```json
   { "version": "v1769098419" }
   ```

6. Run `npm run find-names`.

Missing files answer with a redirect (HTTP 302), not with 404.

## 4. Updating to a new game version

The game updates around the 20th of each month.

1. `npm run fetch-game`
2. Check the last lines of the output:
   - `Found 95 of 95 names` means the dev console works with the new version.
   - Any `problem:` line means a name was not found. See [section 5](#5-finding-the-obfuscated-names).
3. `npm start`. The terminal shows `Game v<number> from .../game`.
4. In the game, open the dev console and run a few commands (`guns`, `pos`, `give 1`).

To go back to the old version: delete `game/`, rename `game.previous/` to `game/`, run `npm run find-names`.

## 5. Finding the obfuscated names

### Why

The game's code uses random names like `$0Ме1А` for its variables (the letters are a mix of Latin and look-alike Cyrillic). They can change with every version. The dev console needs about 95 of them: the characters array, the guns array, the heal function, and so on.

They are not written in `devconsole.js`. The console reads them from `desktop/dev/names.js`:

```js
globalThis.PB2_NAMES = {
  version: "v1769098419",
  chars: '$0\u041c\u04351\u0410', // $0Ме1А  characters array (scripts/frame2.js)
  ...
};
```

### Automatic

```bash
npm run find-names                    # reads game/, writes desktop/dev/names.js
node tools/find-names.js --check      # only report
node tools/find-names.js game.previous --out /tmp/old-names.js   # another copy
```

How it works, assuming the code structure stays the same:

1. String constants are replaced by their values. The game keeps all strings in `_strings.js` as variables (`$x = "god"`); after replacement, the code reads `$y=="god"`.
2. Each name is found with a pattern that matches the code around it. All other obfuscated names in the pattern are wildcards. For example, the characters array and your character index come from the `god` cheat command:

   ```js
   if(chatText=="god 1"||chatText=="god")
   {
   $0Ме1А[$НAlНc].hmax*=100000;     // pattern: =="god"\)\s*\{\s*⟨ID⟩\[⟨ID⟩\]\.hmax\*=100000;
   ```

3. A name must give the same result at every place the pattern matches, or it is reported as ambiguous.
4. A few extra checks confirm related names belong together (e.g. each body part's HP with its "broken" flag).

The patterns are the `RULES` list in `tools/find-names.js`. They were tested by renaming all 7579 obfuscated names in the game at random: all of them were still found correctly.

### When a name is not found

The output says which one, e.g. `problem: gunRecoil: pattern not found in scripts/frame2.js`.

1. **Find the old name.** Open the old `desktop/dev/names.js` (from git history, or run `node tools/find-names.js game.previous --out /tmp/old-names.js`). The comment says what it is and which file it is in.
2. **Look at the old code.** Make both copies readable:

   ```bash
   node tools/find-names.js game.previous --decode scripts/frame2.js > /tmp/old.js
   node tools/find-names.js game --decode scripts/frame2.js > /tmp/new.js
   ```

   Search `/tmp/old.js` for the old name, and find the lines the pattern in `RULES` describes.
3. **Find the same code in the new version.** Search `/tmp/new.js` for the parts that are not obfuscated: strings (`"god"`, `"failed"`), numbers (`100000`, `0.3`), readable names (`hmax`, `picken_by`, `event.keyCode===87`, `params`).
4. **Fix the pattern** in `RULES`. Placeholders:
   - `⟨ID⟩` captures a name (in the order of `keys`)
   - `⟨_⟩` is any name, not captured
   - `⟨chars⟩` is a name found by another rule
5. Run `npm run find-names` again until it says `Found 95 of 95`.
6. **Test in the game** with the dev console, e.g. `js eval(PB2_NAMES.chars).length` (number of characters) or `js typeof eval(PB2_NAMES.healChar)` (`function`).

Quick fix without changing a pattern: write the name into `desktop/dev/names.js` by hand. The next `npm run find-names` overwrites it.

If names are missing, the dev console still opens and lists them in red. Only commands that need them fail.

## 6. Configuration

| Variable | Default | What |
|---|---|---|
| `PB2_DEV=0` | on | Turn the dev console off. |
| `PB2_GAME_DIR` | `game/` | Play a different game copy |
| `PB2_VERSION` | from `pb2-version.json` | Version folder used in the URL |
| `PB2_LOGIN`, `PB2_PASSWORD`, `PB2_UID` | `desktop/credentials.json` | Login cookies |

## 7. Troubleshooting

- **"No game files found"** when starting: run `npm run fetch-game`.
- **"Downloading Electron binary..."** on the first `npm start`: normal. Electron 45 downloads its binary on first use, not during `npm install`.
- **`npm install` fails with `ENOENT package.json`**: run it in the repository root, not in `desktop/`.
- **"names.js is for game vX but the game is vY"** in the terminal: run `npm run find-names`.
- **Dev console says names were not found**: see [section 5](#5-finding-the-obfuscated-names).
- **Game console output**: the game page's `console.log` is printed in the terminal running `npm start`. Press `Ctrl+Shift+I` in the window for DevTools.
