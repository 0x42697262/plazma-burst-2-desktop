# health: heal, hp, revive, and the HP keys

Feature flag `health` (on by default; all modes). Code: `src/features/health/`. It owns
the keys `god`, `max_hp`, `hp_bonus` and `hp_bonus_pct`; the per-frame overrides that
apply them are in `src/console/kernel/overrides/frame.ts`.

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
- Everything here is client-only. With the flag off, these commands and keys do not
  exist; saved values are kept but not applied.
