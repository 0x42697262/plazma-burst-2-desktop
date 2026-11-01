# player: commands and overrides on your character

Feature flag `player` (on by default; all modes). Code: `src/features/player/`. The
per-frame overrides for the player settings (`god`, `max_hp`, `hp_bonus`, `speed`,
`jump`, `fly` …) are applied by `src/console/kernel/overrides/frame.ts` and follow the
same flag.

- `heal` refills your HP to your current max. It refuses while you are down, because
  the body has to be stood up first.
- `hp <n>` sets `max_hp`. `hp +n` adds a flat bonus (`hp_bonus`), and `hp +n%` adds a
  percentage of the game's own max (`hp_bonus_pct`). A bonus applies once per life and
  per level, so it never stacks. While `max_hp` is set, `hp +n` changes that number. A
  relative change needs its sign: `hp 50%` is refused.
- `revive [# | --all]` stands the body up where it lies and refills HP, the way a
  defibrillator does (`services/revive.ts`):
  - Body parts get their spawn share of max HP back (head 0.4, face 0.6, legs 0.5,
    arms 0.4; the character constructor in `frame2.js`), at least 30.
  - The game never revives a character whose head is destroyed, so those parts are
    repaired first.
  - The game's revive sets HP to 10 × power, so power is max HP / 10.
  - Dying in single-player sets the level to "failed" and fades to black. Once you are
    alive again that is undone, and the game is unpaused if the fade paused it.
- `tp`:
  - `tp` alone goes to the crosshair; `tp x y` to coordinates.
  - `tp <# | name>` goes to a character, read from its reference physics point.
  - `--` ends the options, so `tp -- 1 2` is a player named "1 2".
  - `tp --on <key>` and `tp --off` are the old hotkey syntax: a bind to `tp`, through the
    binds feature's `index.ts`.
  - The move itself is the game's own "move character to region" steps
    (`desktop/dev/console/game/teleport.js`, shared with the map editor).
- `pos` shows your position and the crosshair's. `chars` lists the characters, with
  index, team, HP, alive or dead, and distance.
- Everything here is client-only. With the flag off, these commands do not exist and
  the player settings are kept but not applied.
