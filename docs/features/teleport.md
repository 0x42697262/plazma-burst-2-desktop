# teleport: tp

Feature flag `teleport` (on by default; all modes). Code: `src/features/teleport/`.

- `tp` alone goes to the crosshair; `tp x y` to coordinates.
- `tp <# | name>` goes to a character, read from its reference physics point. `to` before
  a name helps when the name could be read as something else.
- `--` ends the options, so `tp -- 1 2` is a player named "1 2".
- `tp --on <key>` and `tp --off` are the old hotkey syntax: a bind to `tp`, through the
  console core's key binder, which the `binds` feature provides. Without `binds` they
  say they need key binds; `tp` itself works.
- The move itself is the game's own "move character to region" steps
  (`src/console/kernel/game/teleport.ts`, shared with the map editor).
- Client-only. It needs no other player feature: an edition can have `tp` alone
  (`editions/player-tp.json`).
