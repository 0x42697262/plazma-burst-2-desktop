# dev_console and console_core

- `dev_console` (on by default; all modes; `PB2_DEV=0` is an alias for `-dev_console`):
  the in-game dev console (Shift+`) and the wrapper's `__dev/` routes. Every console
  feature requires it.
- `console_core` (locked on): the console itself, `src/console/kernel/`: help, settings
  (`list`, `set`, `get`, `unset`, `reset`), `;` chains, `more`/`page`, `clear`, `close`,
  `features`, the panel, the settings store and the game adapter.

## How it works
- The console is one bundle (`dist/console/index.js`) the wrapper serves as
  `__dev/console/index.js` and adds to the game's index.html after the game's own
  scripts, with `names.js`, `opcodes.js` and the page's flags (`PB2_FEATURES`) before it.
- No game function is patched: the game's anti-tamper check compares function source.
  Values are forced from an ENTER_FRAME listener on the game stage
  (`kernel/overrides/frame.ts`) and put back when a setting is removed or the level ends.
- The game's globals are obfuscated and change with every game version. They come from
  `desktop/dev/names.js` (`npm run find-names`); only `kernel/game/` uses them. It reads
  them through cached indirect `eval`, because the game's top-level `let` variables are
  not properties of `globalThis`.
- The console adds no global besides `pb2dev` (the game's anti-tamper scan compares
  globals); its flags global and the page globals the wrapper sets are not enumerable.
- Settings, binds, typed commands and profiles are saved to
  `desktop/dev-overrides.json` through the wrapper (`__dev/kv`), with localStorage as
  the fallback. Editing the file while the game runs reloads it; a broken file is
  reported once and never written over until fixed. The file is not versioned: it is
  edited by hand, and its loader reports any unknown top-level key.
- A line run from DevTools or `eval` (`pb2dev.run` in DevTools, `js pb2dev.run(...)`)
  runs again from a clean timer: the game reloads the page if the first call of its stack
  check sees an anonymous frame.
- `a ; b` runs both in one go: nothing from the game or the network lands between them.
  A `;` in double quotes, in a key-name position (`bind ; heal`), or in a command that
  takes the rest of the line (`js`, `triggers exec`) is not a separator.
