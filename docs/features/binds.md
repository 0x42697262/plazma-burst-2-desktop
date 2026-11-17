# binds: key binds and keyname

Feature flag `binds` (on by default; all modes). Code: `src/features/binds/`. The binds
themselves are kept by the console's store (`dev-overrides.json`, `binds`), and the
panel's key handler runs them.

Capabilities: `binds.bind` (`bind`, `unbind`, and running bound keys) and
`binds.keyname` (`keyname`), one folder each under `capabilities/`.

- `bind <key> <command>` runs a console command with a key in levels, while the
  console and the game chat are both closed. The game never sees a bound key: not the
  press, its repeats, or its release.
- Mouse buttons bind too: `mouse1` (left) to `mouse5`, with modifiers (`ctrl+mouse2`). A bound
  button never reaches the game: the console stops it in the capture phase on `document`,
  before the game's `window.onmousedown` (`main.js:1482`). So binding `mouse1` means it no
  longer shoots; the console says so.
- `bind --hold <key> <command>` runs the command while the key or button is held:
  `<command> --on` when it goes down, `<command> --off` when it comes up. An on/off key (like
  `god`) gets `on` and `off` instead. Only one command can be held, and only one that takes
  `--on`/`--off` (a command marked `holds`, today `fly`) or an on/off key; anything else is
  refused when you bind it. The release is matched by the physical key, so letting go of a
  modifier first still ends the hold. Opening the console or leaving the window lets go of
  every held bind. Held keys are saved in `dev-overrides.json` under `held_binds`; one key
  holds one bind, so binding it again replaces it, held or not. `bind` and `list binds` mark
  them `(hold)`. Profile binds are not held.
- `bind --pass <key> <command>`: the key or button still reaches the game, and the bind runs
  too; `bind --pass mouse1 …` still shoots. It goes with `--hold` in either order
  (`bind --hold --pass mouse1 "fly sweep"` sweeps while you click, and the click fires), and
  there is no "the game uses this key" warning. Passed keys are saved under `pass_binds`;
  binding the key again without `--pass` replaces it. `bind` marks them `(pass)` or
  `(hold, pass)`. Profile binds are not passed.
- A quoted `;` chain is one bind (`bind f "heal; pos"`). Every command in it is checked
  the way it will run: split at `;`, phrases turned into keys
  (`src/console/kernel/commands/command-text.ts`, shared with profiles' `onload`).
- Keys are named by their physical key (`shift+1`), the same on every layout. A typed
  shifted character means Shift and the key under it in the US layout (`>` is
  `shift+period`).
- A hotkey (the screenshot key, the editor key) wins over a bind; a bind wins over a
  game key in levels. The console says so when you bind such a key.
- A map's profile can bind keys too; on its maps those win over yours.
- `keyname` names the next key you press, what it types, and what it does now.
- `list binds` shows your binds.
- With the flag off there is no `bind`, `unbind` or `keyname`, and saved binds stay in
  the file but do not run. `tp --on` and `tp --off` (the `teleport` feature) bind through the
  console core's key binder (`src/console/kernel/ports/key-binder.ts`), which this feature
  provides when it starts; without it they say they need key binds. So `teleport` does not
  import this feature, and an edition can have one without the other.
