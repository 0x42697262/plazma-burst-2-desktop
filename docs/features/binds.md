# binds: key binds and keyname

Feature flag `binds` (on by default; all modes). Code: `src/features/binds/`. The binds
themselves are kept by the console's store (`dev-overrides.json`, `binds`), and the
panel's key handler runs them.

Capabilities: `binds.bind` (`bind`, `unbind`, and running bound keys) and
`binds.keyname` (`keyname`), one folder each under `capabilities/`.

- `bind <key> <command>` runs a console command with a key in levels, while the
  console and the game chat are both closed. The game never sees a bound key: not the
  press, its repeats, or its release.
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
