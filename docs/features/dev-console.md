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
  `data/names.js` (`npm run find-names`); only `kernel/game/` uses them. It reads
  them through cached indirect `eval`, because the game's top-level `let` variables are
  not properties of `globalThis`.
- The console adds no global besides `pb2dev` (the game's anti-tamper scan compares
  globals); its flags global and the page globals the wrapper sets are not enumerable.
- Settings, binds, typed commands and profiles are saved to
  `data/dev-overrides.json` through the wrapper (`__dev/kv`), with localStorage as
  the fallback. Editing the file while the game runs reloads it; a broken file is
  reported once and never written over until fixed. The file is not versioned: it is
  edited by hand, and its loader reports any unknown top-level key.
- A line run from DevTools or `eval` (`pb2dev.run` in DevTools, `js pb2dev.run(...)`)
  runs again from a clean timer: the game reloads the page if the first call of its stack
  check sees an anonymous frame.
- `a ; b` runs both in one go: nothing from the game or the network lands between them.
  A `;` in double quotes, in a key-name position (`bind ; heal`), or in a command that
  takes the rest of the line (`js`, `triggers exec`) is not a separator.

## Tests: the fake game
- `src/console/testing/fake-game.fixture.ts` is a fake Plazma Burst 2 runtime: it
  installs the game's globals on `globalThis`, then loads and starts the real console
  (`src/console/index.ts`). `bootConsole()` returns helpers that drive it: `run` (a line,
  returning what it printed without the echoed command), `press` (a key with the console
  closed), `frame`, `dispatch` (a DOM event on a fake node) and `intervals` (every
  `setInterval` callback in the order made; the first is the boot poll, which the fixture
  runs to start the console).
- Every game name is `__pb2_<key>`. The keys come from find-names' rules
  (`src/tools/find-names/constants.ts`, the same table that generates `names.js`), so a
  fresh clone needs neither `names.js` nor the game.
- Triggers, regions, timers, players and decorations come from a map file
  (`test/fixtures/map.xml`). Targets are fixed up the way the game's map loader does
  (`#uid` becomes an index, whole numbers become numbers), and the region modes 8, 11, 12
  and 15 (hidden use keys) become the plain ones, as the loader rewrites them
  (`frame2.js`). `sayTrigger` names the map's "player says" trigger, which the game sets
  when the map runs.
- The trigger runner is named like the game's and reads "enabled" the way the game does,
  so the run log sees it.
- Events are delivered as a browser does: the document's capture listeners, then the
  target and its parents until one stops it, then the document's bubble listeners, then
  the window's `on<type>` handler. `window.addEventListener` does nothing, as in the game
  (`scripts/flash.js` sends it to the graphics stage, which sends no DOM events).
- The game canvas is 1600×800 at resolution 2 (two pixels per game unit); its 2D context
  records what is drawn (`log.drawn`) instead of drawing it.
- `src/console/testing/net-protocol.fixture.ts` encodes the game's network numbers and
  messages and makes a fake connection whose receive method is on its prototype, as the
  game's is. `src/server/testing/game-client.fixture.ts` is a headless game client: the
  game's own client scripts in a `vm` context, talking to the private server. A message it
  cannot act on (it has no page) is only noted, because reliable messages are handled in
  order and one failure would stop every later one.
